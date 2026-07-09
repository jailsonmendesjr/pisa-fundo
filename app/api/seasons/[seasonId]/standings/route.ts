import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateStandings, getSeasonStandingsWithChanges } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: any }
) {
  try {
    const resolvedParams = await context.params;
    const seasonIdStr = resolvedParams.seasonId;

    if (!seasonIdStr) {
      return NextResponse.json({ error: "O parâmetro seasonId é obrigatório." }, { status: 400 });
    }

    const seasonId = parseInt(seasonIdStr, 10);
    if (isNaN(seasonId)) {
      return NextResponse.json({ error: "O parâmetro seasonId deve ser um número inteiro." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const compare = searchParams.get("compare") === "true";

    // Busca usando o nome real da tabela do Django
    const { data: season, error: seasonError } = await supabase
      .from("championship_season")
      .select("id")
      .eq("id", seasonId)
      .maybeSingle();

    if (seasonError) {
      return NextResponse.json({ error: seasonError.message }, { status: 500 });
    }

    if (!season) {
      return NextResponse.json({ error: `Temporada ${seasonId} não encontrada.` }, { status: 404 });
    }

    const standings = compare
      ? await getSeasonStandingsWithChanges(supabase, seasonId)
      : await calculateStandings(supabase, seasonId);

    return NextResponse.json(standings);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}