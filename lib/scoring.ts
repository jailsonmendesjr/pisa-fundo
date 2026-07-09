/**
 * lib/scoring.ts
 *
 * Regras de negócio PURAS do Campeonato Pisa Fundo.
 * Sem acesso a banco de dados — apenas lógica e cálculo.
 *
 * Porta fiel das regras definidas em:
 *   - championship/models.py  (POINTS_2025, POINTS_2026, RoundResult.save)
 *   - championship/views.py   (calculate_standings, lógica de equipes)
 */

// ---------------------------------------------------------------------------
// 1. TABELAS DE PONTUAÇÃO
// ---------------------------------------------------------------------------

/**
 * Tabela de pontos usada nas temporadas até 2025.
 * Espelha POINTS_2025 em models.py (linhas 5-8).
 */
export const POINTS_2025: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

/**
 * Tabela de pontos usada nas temporadas a partir de 2026.
 * Espelha POINTS_2026 em models.py (linhas 10-13).
 */
export const POINTS_2026: Record<number, number> = {
  1: 18,
  2: 15,
  3: 13,
  4: 11,
  5: 9,
  6: 7,
  7: 5,
  8: 3,
  9: 2,
  10: 1,
};

/**
 * Mapa agregado de tabelas de pontuação por ano.
 * Para acessar a tabela correta: SCORING_TABLES[seasonYear] ?? POINTS_2026
 */
export const SCORING_TABLES: Record<number, Record<number, number>> = {
  2025: POINTS_2025,
  2026: POINTS_2026,
};

// ---------------------------------------------------------------------------
// 2. CÁLCULO DE PONTOS
// ---------------------------------------------------------------------------

/**
 * Status possíveis de um resultado de corrida.
 * Espelha STATUS_CHOICES em RoundResult (models.py, linhas 100-103).
 */
export type ResultStatus = "COMPLETED" | "DNF" | "DNS";

/**
 * Calcula os pontos de um resultado de corrida.
 *
 * Porta fiel do método `RoundResult.save()` em models.py (linhas 145-158):
 *   - DNF ou DNS -> sempre 0 pontos.
 *   - COMPLETED  -> pontos da tabela do ano + bonus de +1 pela volta rapida.
 *   - Posicao fora do top 10 (ou nao encontrada na tabela) -> 0 pontos base.
 *
 * @param position    Posicao de chegada (1-based). Ignorado se status != COMPLETED.
 * @param seasonYear  Ano da temporada. Determina qual tabela usar.
 * @param fastestLap  Se o piloto marcou a volta mais rapida da etapa.
 * @param status      Status da corrida. Default "COMPLETED".
 * @returns           Pontos totais a serem atribuidos ao resultado.
 *
 * @example
 * calculatePoints(1, 2026, true)           // 18 + 1 = 19
 * calculatePoints(1, 2025, false)          // 25
 * calculatePoints(3, 2026, true)           // 13 + 1 = 14
 * calculatePoints(1, 2026, false, "DNF")   // 0
 * calculatePoints(11, 2026, false)         // 0 (fora do top 10)
 */
export function calculatePoints(
  position: number,
  seasonYear: number,
  fastestLap: boolean,
  status: ResultStatus = "COMPLETED"
): number {
  // DNF ou DNS: sem pontuacao, independente de posicao ou volta rapida.
  if (status === "DNF" || status === "DNS") {
    return 0;
  }

  // Seleciona a tabela do ano. Se o ano nao existir no mapa,
  // usa POINTS_2026 como padrao (temporadas futuras herdam a tabela mais recente).
  const table = SCORING_TABLES[seasonYear] ?? POINTS_2026;

  // Pontos base da posicao (0 se fora do top 10).
  const basePoints = table[position] ?? 0;

  // Bonus de volta rapida: +1 ponto apenas em corridas concluidas.
  const fastestLapBonus = fastestLap ? 1 : 0;

  return basePoints + fastestLapBonus;
}

// ---------------------------------------------------------------------------
// 3. TIPOS DO RANKING
// ---------------------------------------------------------------------------

/**
 * Representa um unico resultado de corrida que sera processado pelo motor
 * de classificacao. Contem apenas os campos necessarios para o calculo.
 */
export interface RaceResult {
  /** ID da inscricao (DriverTeamSeason.id) */
  entryId: string;
  /** Pontos ja calculados pelo calculatePoints() */
  points: number;
  /** Posicao de chegada */
  position: number;
  /** Status da corrida */
  status: ResultStatus;
}

/**
 * Representa uma inscricao de piloto em uma temporada, com os contadores
 * acumulados usados para montar o ranking.
 */
export interface DriverStandingEntry {
  /** ID da inscricao (DriverTeamSeason.id) */
  entryId: string;
  /** ID do piloto */
  driverId: string;
  /** Nome completo do piloto */
  driverName: string;
  /** ID da equipe */
  teamId: string;
  /** Nome da equipe */
  teamName: string;
  /** Cor primaria da equipe (hex) */
  teamColor: string;
  /** Numero do carro nesta temporada */
  carNumber: number | null;
  /** Flag de convidado — convidados sao excluidos do ranking geral */
  isGuest: boolean;
  /** Pontos totais acumulados (calculado) */
  totalPoints: number;
  /** Numero de vitorias (posicao 1 + status COMPLETED) */
  wins: number;
  /** Numero de podios (posicao 1, 2 ou 3 + status COMPLETED) */
  podiums: number;
  /** Posicao no ranking (calculado pelo sortDriverStandings) */
  position?: number;
  /** Variacao de posicao em relacao a etapa anterior (calculado) */
  change?: number;
}

/**
 * Representa uma equipe no ranking de construtores.
 */
export interface TeamStandingEntry {
  /** ID da equipe */
  teamId: string;
  /** Nome da equipe */
  teamName: string;
  /** Cor primaria (hex) */
  teamColor: string;
  /** Pontos totais somados de todos os pilotos (nao-convidados) */
  totalPoints: number;
  /** Vitorias somadas */
  wins: number;
  /** Podios somados */
  podiums: number;
  /** Resumo de pilotos — ex: "Clauston (120) - Rafael (98)" */
  driversSummary: string;
  /** Posicao no ranking (calculado) */
  position?: number;
  /** Variacao de posicao em relacao a etapa anterior */
  change?: number;
}

// ---------------------------------------------------------------------------
// 4. ORDENACAO E DESEMPATE
// ---------------------------------------------------------------------------

/**
 * Ordena um array de entradas do ranking de pilotos aplicando o desempate
 * em cascata identico ao Django (views.py, linhas 57-63):
 *
 * 1 criterio: totalPoints  (maior primeiro)
 * 2 criterio: wins         (maior primeiro)
 * 3 criterio: podiums      (maior primeiro)
 * 4 criterio: driverName   (A-Z, para garantir estabilidade)
 *
 * Atribui `position` (1-based) a cada entrada apos a ordenacao.
 * Nao modifica o array original — retorna um novo array.
 *
 * @param entries Array de DriverStandingEntry (pode conter convidados ainda).
 * @returns       Novo array ordenado com `position` preenchido.
 */
export function sortDriverStandings(
  entries: DriverStandingEntry[]
): DriverStandingEntry[] {
  return [...entries]
    .sort((a, b) => {
      // 1: mais pontos vem primeiro
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      // 2: mais vitorias vem primeiro
      if (b.wins !== a.wins) return b.wins - a.wins;
      // 3: mais podios vem primeiro
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      // 4: ordem alfabetica por nome (A-Z) - garante estabilidade deterministica
      return a.driverName.toLowerCase().localeCompare(b.driverName.toLowerCase());
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

/**
 * Ordena um array de entradas do ranking de equipes com os mesmos criterios
 * de desempate usados para pilotos (views.py, linhas 103-109):
 *
 * 1: totalPoints (maior primeiro)
 * 2: wins        (maior primeiro)
 * 3: podiums     (maior primeiro)
 * 4: teamName    (A-Z)
 *
 * Atribui `position` (1-based) a cada equipe apos a ordenacao.
 *
 * @param entries Array de TeamStandingEntry.
 * @returns       Novo array ordenado com `position` preenchido.
 */
export function sortTeamStandings(
  entries: TeamStandingEntry[]
): TeamStandingEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.podiums !== a.podiums) return b.podiums - a.podiums;
      return a.teamName.toLowerCase().localeCompare(b.teamName.toLowerCase());
    })
    .map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
}

// ---------------------------------------------------------------------------
// 5. ACUMULACAO DE PONTOS
// ---------------------------------------------------------------------------

/**
 * Processa uma lista de resultados de corridas e os acumula nas entradas
 * de piloto correspondentes. Logica portada de `calculate_standings` em
 * views.py (linhas 34-55).
 *
 * Esta funcao e PURA: recebe os dados brutos e retorna os contadores
 * atualizados sem tocar no banco de dados.
 *
 * @param entries  Lista de DriverStandingEntry (geralmente sem convidados).
 * @param results  Lista de RaceResult de todas as etapas relevantes.
 * @returns        Nova lista com totalPoints, wins e podiums preenchidos.
 */
export function accumulateDriverPoints(
  entries: DriverStandingEntry[],
  results: RaceResult[]
): DriverStandingEntry[] {
  // Cria um mapa entryId -> objeto mutavel para acumulacao
  const entryMap = new Map<string, DriverStandingEntry>();
  for (const entry of entries) {
    entryMap.set(entry.entryId, {
      ...entry,
      totalPoints: 0,
      wins: 0,
      podiums: 0,
    });
  }

  for (const result of results) {
    const entry = entryMap.get(result.entryId);
    if (!entry) continue; // Resultado de convidado ou piloto nao listado - ignora.

    entry.totalPoints += result.points;

    if (result.status === "COMPLETED") {
      if (result.position === 1) {
        entry.wins += 1;
      }
      if (result.position <= 3) {
        entry.podiums += 1;
      }
    }
  }

  return Array.from(entryMap.values());
}

// ---------------------------------------------------------------------------
// 6. RANKING DE EQUIPES
// ---------------------------------------------------------------------------

/**
 * Agrega as entradas de pilotos em um ranking de equipes.
 * Porta a logica do bloco "Calculo das Equipes" em views.py (linhas 65-109).
 *
 * - Convidados (isGuest: true) sao ignorados.
 * - Gera o driversSummary com pilotos ordenados por pontos dentro da equipe.
 *
 * @param driverEntries Entradas de piloto ja com pontos acumulados.
 * @returns             Array de TeamStandingEntry (sem `position` ainda -
 *                      chame `sortTeamStandings()` em seguida).
 */
export function buildTeamStandings(
  driverEntries: DriverStandingEntry[]
): TeamStandingEntry[] {
  const teamsMap = new Map<
    string,
    { entry: TeamStandingEntry; drivers: DriverStandingEntry[] }
  >();

  for (const driver of driverEntries) {
    // Convidados nao contam para o ranking de equipes.
    if (driver.isGuest) continue;

    if (!teamsMap.has(driver.teamId)) {
      teamsMap.set(driver.teamId, {
        entry: {
          teamId: driver.teamId,
          teamName: driver.teamName,
          teamColor: driver.teamColor,
          totalPoints: 0,
          wins: 0,
          podiums: 0,
          driversSummary: "",
        },
        drivers: [],
      });
    }

    const teamData = teamsMap.get(driver.teamId)!;
    teamData.entry.totalPoints += driver.totalPoints;
    teamData.entry.wins += driver.wins;
    teamData.entry.podiums += driver.podiums;
    teamData.drivers.push(driver);
  }

  // Gera o driversSummary: pilotos ordenados por pontos dentro da equipe.
  // Ex: "Clauston (120) - Rafael (98)"  espelha views.py linhas 97-100.
  const result: TeamStandingEntry[] = [];
  for (const { entry, drivers } of teamsMap.values()) {
    const sortedDrivers = [...drivers].sort(
      (a, b) => b.totalPoints - a.totalPoints
    );
    entry.driversSummary = sortedDrivers
      .map((d) => `${d.driverName.split(" ")[0]} (${d.totalPoints})`)
      .join(" \u2022 ");
    result.push(entry);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 7. CALCULO DAS VARIACOES DE POSICAO (SETAS UP/DOWN)
// ---------------------------------------------------------------------------

/**
 * Calcula a variacao de posicao de cada piloto entre dois rankings:
 * o ranking atual e o ranking sem a ultima etapa (ranking "anterior").
 *
 * Porta a logica de views.py (linhas 119-133):
 *   change = posicao_anterior - posicao_atual
 *   Positivo  -> subiu posicoes
 *   Negativo  -> caiu posicoes
 *   Zero      -> manteve posicao
 *
 * @param current  Ranking atual (ja com `position` atribuido).
 * @param previous Ranking anterior (calculado sem a ultima etapa).
 * @returns        Novo array com o campo `change` preenchido.
 */
export function applyDriverPositionChanges(
  current: DriverStandingEntry[],
  previous: DriverStandingEntry[]
): DriverStandingEntry[] {
  const previousMap = new Map<string, number>(
    previous.map((d) => [d.driverId, d.position ?? 0])
  );

  return current.map((entry) => {
    const oldPosition = previousMap.get(entry.driverId);
    const change =
      oldPosition !== undefined ? oldPosition - (entry.position ?? 0) : 0;
    return { ...entry, change };
  });
}

/**
 * Mesma logica de applyDriverPositionChanges, mas para o ranking de equipes.
 *
 * @param current  Ranking atual de equipes.
 * @param previous Ranking anterior de equipes.
 * @returns        Novo array com `change` preenchido.
 */
export function applyTeamPositionChanges(
  current: TeamStandingEntry[],
  previous: TeamStandingEntry[]
): TeamStandingEntry[] {
  const previousMap = new Map<string, number>(
    previous.map((t) => [t.teamId, t.position ?? 0])
  );

  return current.map((entry) => {
    const oldPosition = previousMap.get(entry.teamId);
    const change =
      oldPosition !== undefined ? oldPosition - (entry.position ?? 0) : 0;
    return { ...entry, change };
  });
}
