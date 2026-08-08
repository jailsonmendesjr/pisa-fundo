import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDriversListForSeason } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ seasonId: string }> }
) {
  const seasonId = Number.parseInt((await context.params).seasonId, 10);

  if (!Number.isInteger(seasonId)) {
    return NextResponse.json(
      { error: "O parâmetro seasonId deve ser um número inteiro." },
      { status: 400 }
    );
  }

  try {
    const [seasonResponse, drivers] = await Promise.all([
      supabase
        .from("championship_season")
        .select("id, name, year")
        .eq("id", seasonId)
        .maybeSingle(),
      getDriversListForSeason(supabase, seasonId),
    ]);

    if (seasonResponse.error) {
      throw seasonResponse.error;
    }

    if (!seasonResponse.data) {
      return NextResponse.json(
        { error: `Temporada ${seasonId} não encontrada.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ season: seasonResponse.data, drivers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
