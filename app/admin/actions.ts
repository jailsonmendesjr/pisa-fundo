"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import type { Json } from "@/lib/database.types";

type DatabaseError = {
  code?: string;
  message?: string;
};

function getErrorMessage(error: unknown) {
  const databaseError = error as DatabaseError;

  if (databaseError.code === "23505") {
    return "Já existe um cadastro com esses dados.";
  }
  if (databaseError.code === "23503") {
    return "Este registro está vinculado a outro cadastro.";
  }
  if (databaseError.code === "42501") {
    return "Sua conta não possui permissão para esta alteração.";
  }

  return databaseError.message ?? "Não foi possível salvar a alteração.";
}

function failIfError(error: DatabaseError | null) {
  if (error) throw error;
}

function requiredText(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`O campo ${name} é obrigatório.`);
  if (value.length > maxLength) {
    throw new Error(`O campo ${name} aceita no máximo ${maxLength} caracteres.`);
  }
  return value;
}

function optionalText(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (value.length > maxLength) {
    throw new Error(`O campo ${name} aceita no máximo ${maxLength} caracteres.`);
  }
  return value;
}

function integerValue(formData: FormData, name: string, min = 1) {
  const value = Number.parseInt(String(formData.get(name) ?? ""), 10);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`O campo ${name} deve ser um número válido.`);
  }
  return value;
}

function optionalInteger(formData: FormData, name: string, min = 0) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`O campo ${name} deve ser um número válido.`);
  }
  return value;
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function colorValue(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(value)) {
    throw new Error("Use cores no formato hexadecimal #RRGGBB.");
  }
  return value;
}

function destination(path: string, kind: "success" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${kind}=${encodeURIComponent(message)}`;
}

async function completeMutation(
  path: string,
  successMessage: string,
  mutation: () => Promise<void>
) {
  let errorMessage: string | null = null;

  try {
    await mutation();
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  if (errorMessage) {
    redirect(destination(path, "error", errorMessage));
  }

  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect(destination(path, "success", successMessage));
}

export async function createSeason(formData: FormData) {
  await completeMutation("/admin/campeonatos", "Campeonato criado.", async () => {
    const { supabase } = await requireAdmin();
    const name = requiredText(formData, "name", 100);
    const year = integerValue(formData, "year", 2000);
    const activate = formData.get("activate") === "on";
    const { data, error } = await supabase
      .from("championship_season")
      .insert({ name, year, is_active: false })
      .select("id")
      .single();
    failIfError(error);

    if (activate && data) {
      const { error: activationError } = await supabase.rpc(
        "activate_championship_season",
        { p_season_id: data.id }
      );
      failIfError(activationError);
    }
  });
}

export async function updateSeason(formData: FormData) {
  await completeMutation("/admin/campeonatos", "Campeonato atualizado.", async () => {
    const { supabase } = await requireAdmin();
    const id = integerValue(formData, "id");
    const { error } = await supabase
      .from("championship_season")
      .update({
        name: requiredText(formData, "name", 100),
        year: integerValue(formData, "year", 2000),
      })
      .eq("id", id);
    failIfError(error);
  });
}

export async function activateSeason(formData: FormData) {
  await completeMutation("/admin/campeonatos", "Campeonato ativado.", async () => {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.rpc("activate_championship_season", {
      p_season_id: integerValue(formData, "id"),
    });
    failIfError(error);
  });
}

export async function createTeam(formData: FormData) {
  await completeMutation("/admin/equipes", "Equipe criada.", async () => {
    const { supabase } = await requireAdmin();
    const name = requiredText(formData, "name", 100);
    const requestedSlug = optionalText(formData, "slug", 120);
    const { error } = await supabase.from("championship_team").insert({
      name,
      slug: requestedSlug || slugify(name),
      primary_color: colorValue(formData, "primary_color"),
      secondary_color: colorValue(formData, "secondary_color"),
    });
    failIfError(error);
  });
}

export async function updateTeam(formData: FormData) {
  await completeMutation("/admin/equipes", "Equipe atualizada.", async () => {
    const { supabase } = await requireAdmin();
    const name = requiredText(formData, "name", 100);
    const requestedSlug = optionalText(formData, "slug", 120);
    const { error } = await supabase
      .from("championship_team")
      .update({
        name,
        slug: requestedSlug || slugify(name),
        primary_color: colorValue(formData, "primary_color"),
        secondary_color: colorValue(formData, "secondary_color"),
      })
      .eq("id", integerValue(formData, "id"));
    failIfError(error);
  });
}

export async function createDriver(formData: FormData) {
  await completeMutation("/admin/pilotos", "Piloto criado.", async () => {
    const { supabase } = await requireAdmin();
    const name = requiredText(formData, "name", 100);
    const requestedSlug = optionalText(formData, "slug", 120);
    const { error } = await supabase.from("championship_driver").insert({
      name,
      nickname: optionalText(formData, "nickname", 50),
      slug: requestedSlug || slugify(name),
      number: optionalInteger(formData, "number"),
    });
    failIfError(error);
  });
}

export async function updateDriver(formData: FormData) {
  await completeMutation("/admin/pilotos", "Piloto atualizado.", async () => {
    const { supabase } = await requireAdmin();
    const name = requiredText(formData, "name", 100);
    const requestedSlug = optionalText(formData, "slug", 120);
    const { error } = await supabase
      .from("championship_driver")
      .update({
        name,
        nickname: optionalText(formData, "nickname", 50),
        slug: requestedSlug || slugify(name),
        number: optionalInteger(formData, "number"),
      })
      .eq("id", integerValue(formData, "id"));
    failIfError(error);
  });
}

export async function createEntry(formData: FormData) {
  const seasonId = integerValue(formData, "season_id");
  await completeMutation(
    `/admin/inscricoes?season=${seasonId}`,
    "Inscrição criada.",
    async () => {
      const { supabase } = await requireAdmin();
      const { error } = await supabase
        .from("championship_driverteamseason")
        .insert({
          season_id: seasonId,
          team_id: integerValue(formData, "team_id"),
          driver_id: integerValue(formData, "driver_id"),
          car_number: optionalInteger(formData, "car_number"),
          is_guest: formData.get("is_guest") === "on",
        });
      failIfError(error);
    }
  );
}

export async function updateEntry(formData: FormData) {
  const seasonId = integerValue(formData, "season_id");
  await completeMutation(
    `/admin/inscricoes?season=${seasonId}`,
    "Inscrição atualizada.",
    async () => {
      const { supabase } = await requireAdmin();
      const { error } = await supabase
        .from("championship_driverteamseason")
        .update({
          team_id: integerValue(formData, "team_id"),
          driver_id: integerValue(formData, "driver_id"),
          car_number: optionalInteger(formData, "car_number"),
          is_guest: formData.get("is_guest") === "on",
        })
        .eq("id", integerValue(formData, "id"));
      failIfError(error);
    }
  );
}

export async function createRound(formData: FormData) {
  const seasonId = integerValue(formData, "season_id");
  await completeMutation(
    `/admin/etapas?season=${seasonId}`,
    "Etapa criada.",
    async () => {
      const { supabase } = await requireAdmin();
      const { error } = await supabase.from("championship_round").insert({
        season_id: seasonId,
        name: requiredText(formData, "name", 100),
        date: requiredText(formData, "date", 10),
        location: requiredText(formData, "location", 100),
        order: integerValue(formData, "order"),
      });
      failIfError(error);
    }
  );
}

export async function updateRound(formData: FormData) {
  const seasonId = integerValue(formData, "season_id");
  await completeMutation(
    `/admin/etapas?season=${seasonId}`,
    "Etapa atualizada.",
    async () => {
      const { supabase } = await requireAdmin();
      const { error } = await supabase
        .from("championship_round")
        .update({
          name: requiredText(formData, "name", 100),
          date: requiredText(formData, "date", 10),
          location: requiredText(formData, "location", 100),
          order: integerValue(formData, "order"),
        })
        .eq("id", integerValue(formData, "id"));
      failIfError(error);
    }
  );
}

export async function saveRoundResults(formData: FormData) {
  const roundId = integerValue(formData, "round_id");
  await completeMutation(
    `/admin/resultados?round=${roundId}`,
    "Resultados publicados.",
    async () => {
      const { supabase } = await requireAdmin();
      const entryIds = formData
        .getAll("entry_id")
        .map((value) => Number.parseInt(String(value), 10))
        .filter(Number.isSafeInteger);
      const results: Json[] = [];

      for (const entryId of entryIds) {
        const status = String(formData.get(`status_${entryId}`) ?? "");
        if (!status) continue;
        if (!["COMPLETED", "DNF", "DNS"].includes(status)) {
          throw new Error("Status de resultado inválido.");
        }

        const position = Number.parseInt(
          String(formData.get(`position_${entryId}`) ?? ""),
          10
        );
        if (!Number.isInteger(position) || position < 1) {
          throw new Error("Informe uma posição válida para todos os resultados lançados.");
        }

        const hasPenalty = formData.get(`penalty_${entryId}`) === "on";
        const penaltyReason = String(
          formData.get(`penalty_reason_${entryId}`) ?? ""
        ).trim();
        if (hasPenalty && !penaltyReason) {
          throw new Error("Informe o motivo de cada penalidade marcada.");
        }

        results.push({
          entry_id: entryId,
          position,
          status,
          fastest_lap: formData.get(`fastest_${entryId}`) === "on",
          has_penalty: hasPenalty,
          penalty_reason: hasPenalty ? penaltyReason : "",
        });
      }

      const { error } = await supabase.rpc("replace_round_results", {
        p_round_id: roundId,
        p_results: results,
      });
      failIfError(error);
    }
  );
}
