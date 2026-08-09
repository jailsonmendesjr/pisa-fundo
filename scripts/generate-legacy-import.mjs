import fs from "node:fs";
import path from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error(
    "Uso: node scripts/generate-legacy-import.mjs <backup.json> <migration.sql>"
  );
  process.exit(1);
}

const fixture = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (!Array.isArray(fixture)) {
  throw new Error("O backup precisa ser uma lista de objetos do fixture Django.");
}

const model = (name) => fixture.filter((row) => row.model === name);
const ids = (name) => new Set(model(name).map((row) => row.pk));
const failIf = (condition, message) => {
  if (condition) throw new Error(message);
};

const seasons = ids("championship.season");
const teams = ids("championship.team");
const drivers = ids("championship.driver");
const entries = ids("championship.driverteamseason");
const rounds = ids("championship.round");

for (const row of fixture) {
  if (row.model === "auth.user") continue;
  failIf(
    !Number.isSafeInteger(row.pk) || row.pk < 1,
    `PK invalida em ${row.model}: ${row.pk}`
  );
}

for (const row of model("championship.driverteamseason")) {
  failIf(!seasons.has(row.fields.season), `Temporada ausente na inscricao ${row.pk}`);
  failIf(!teams.has(row.fields.team), `Equipe ausente na inscricao ${row.pk}`);
  failIf(!drivers.has(row.fields.driver), `Piloto ausente na inscricao ${row.pk}`);
}

for (const row of model("championship.round")) {
  failIf(!seasons.has(row.fields.season), `Temporada ausente na etapa ${row.pk}`);
}

for (const row of model("championship.roundresult")) {
  failIf(!rounds.has(row.fields.round), `Etapa ausente no resultado ${row.pk}`);
  failIf(!entries.has(row.fields.entry), `Inscricao ausente no resultado ${row.pk}`);
}

const duplicateKeys = (rows, key) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    const value = key(row);
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

failIf(
  duplicateKeys(model("championship.driverteamseason"), (row) =>
    `${row.fields.season}:${row.fields.driver}`
  ).length > 0,
  "Ha piloto inscrito mais de uma vez na mesma temporada."
);
failIf(
  duplicateKeys(model("championship.round"), (row) =>
    `${row.fields.season}:${row.fields.order}`
  ).length > 0,
  "Ha ordem de etapa duplicada na mesma temporada."
);
failIf(
  duplicateKeys(model("championship.roundresult"), (row) =>
    `${row.fields.round}:${row.fields.entry}`
  ).length > 0,
  "Ha resultado duplicado para o mesmo piloto e etapa."
);
failIf(
  duplicateKeys(
    model("championship.roundresult").filter((row) => row.fields.status !== "DNS"),
    (row) => `${row.fields.round}:${row.fields.position}`
  ).length > 0,
  "Ha posicao duplicada em uma etapa."
);
failIf(
  duplicateKeys(
    model("championship.roundresult").filter((row) => row.fields.fastest_lap),
    (row) => String(row.fields.round)
  ).length > 0,
  "Ha mais de uma volta rapida em uma etapa."
);

const teamCounts = new Map();
for (const row of model("championship.driverteamseason")) {
  const key = `${row.fields.season}:${row.fields.team}`;
  teamCounts.set(key, (teamCounts.get(key) ?? 0) + 1);
}
failIf(
  [...teamCounts.values()].some((count) => count > 2),
  "Ha equipe com mais de dois pilotos em uma temporada."
);

const activeSeasons = model("championship.season").filter(
  (row) => row.fields.is_active
);
failIf(activeSeasons.length > 1, "O backup possui mais de um campeonato ativo.");

const invalidColors = model("championship.team").flatMap((row) =>
  ["primary_color", "secondary_color"]
    .filter((field) => !/^#[0-9a-fA-F]{6}$/.test(row.fields[field]))
    .map((field) => `${row.fields.name}.${field}=${row.fields[field]}`)
);

if (invalidColors.length > 0) {
  console.warn(
    `Aviso: cores legadas mantidas para correcao no painel: ${invalidColors.join(", ")}`
  );
}

const sqlValue = (value) => {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    failIf(!Number.isFinite(value), `Numero invalido: ${value}`);
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
};

const insert = (table, columns, rows, values) => {
  if (rows.length === 0) return "";
  return [
    `insert into public.${table} (${columns.join(", ")}) values`,
    rows.map((row) => `  (${values(row).map(sqlValue).join(", ")})`).join(",\n") + ";",
  ].join("\n");
};

const tables = [
  "championship_season",
  "championship_team",
  "championship_driver",
  "championship_driverteamseason",
  "championship_round",
  "championship_roundresult",
];

const statements = [
  insert(
    "championship_season",
    ["id", "name", "year", "is_active"],
    model("championship.season"),
    (row) => [row.pk, row.fields.name, row.fields.year, row.fields.is_active]
  ),
  insert(
    "championship_team",
    ["id", "name", "slug", "primary_color", "secondary_color"],
    model("championship.team"),
    (row) => [
      row.pk,
      row.fields.name,
      row.fields.slug,
      row.fields.primary_color,
      row.fields.secondary_color,
    ]
  ),
  insert(
    "championship_driver",
    ["id", "name", "nickname", "slug", "number"],
    model("championship.driver"),
    (row) => [
      row.pk,
      row.fields.name,
      row.fields.nickname,
      row.fields.slug,
      row.fields.number,
    ]
  ),
  insert(
    "championship_driverteamseason",
    ["id", "season_id", "team_id", "driver_id", "car_number", "is_guest"],
    model("championship.driverteamseason"),
    (row) => [
      row.pk,
      row.fields.season,
      row.fields.team,
      row.fields.driver,
      row.fields.car_number,
      row.fields.is_guest,
    ]
  ),
  insert(
    "championship_round",
    ["id", "season_id", "name", "date", "location", '"order"'],
    model("championship.round"),
    (row) => [
      row.pk,
      row.fields.season,
      row.fields.name,
      row.fields.date,
      row.fields.location,
      row.fields.order,
    ]
  ),
  insert(
    "championship_roundresult",
    [
      "id",
      "round_id",
      "entry_id",
      "position",
      "status",
      "fastest_lap",
      "has_penalty",
      "penalty_reason",
      "points",
    ],
    model("championship.roundresult"),
    (row) => [
      row.pk,
      row.fields.round,
      row.fields.entry,
      row.fields.position,
      row.fields.status,
      row.fields.fastest_lap,
      row.fields.has_penalty,
      row.fields.penalty_reason,
      row.fields.points,
    ]
  ),
];

const sequenceStatements = tables.map(
  (table) =>
    `select setval(pg_get_serial_sequence('public.${table}', 'id'), (select max(id) from public.${table}), true);`
);

const championshipRows = fixture.filter((row) => row.model.startsWith("championship."));
const output = [
  "-- Generated from the legacy Django fixture.",
  "-- auth.user is intentionally excluded; Supabase Auth owns identities.",
  `-- Source records: ${championshipRows.length}.`,
  "",
  "begin;",
  "set local statement_timeout = '30s';",
  "",
  ...statements.filter(Boolean).flatMap((statement) => [statement, ""]),
  ...sequenceStatements,
  "",
  "commit;",
  "",
].join("\n");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output, "utf8");

console.log(
  JSON.stringify(
    {
      output: path.resolve(outputPath),
      importedRecords: championshipRows.length,
      excludedAuthUsers: model("auth.user").length,
      invalidColors,
    },
    null,
    2
  )
);
