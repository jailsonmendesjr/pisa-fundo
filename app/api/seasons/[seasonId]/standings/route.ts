import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateStandings, getSeasonStandingsWithChanges } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ seasonId: string }> | { seasonId: string } }
) {
  try {
    const params = await context.params;
    const seasonId = params.seasonId;

    if (!seasonId) {
      return NextResponse.json(
        { error: "O parâmetro seasonId é obrigatório." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const compare = searchParams.get("compare") === "true";

    // Validar se a temporada existe no Supabase para retornar um erro apropriado
    const { data: season, error: seasonError } = await supabase
      .from("seasons")
      .select("id")
      .eq("id", seasonId)
      .maybeSingle();

    if (seasonError) {
      return NextResponse.json(
        { error: `Erro ao verificar a temporada: ${seasonError.message}` },
        { status: 500 }
      );
    }

    if (!season) {
      return NextResponse.json(
        { error: `Temporada com ID ${seasonId} não encontrada.` },
        { status: 404 }
      );
    }

    // Calcula os standings usando o motor typescript correspondente
    const standings = compare
      ? await getSeasonStandingsWithChanges(supabase, seasonId)
      : await calculateStandings(supabase, seasonId);

    return NextResponse.json(standings);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro ao calcular classificação da temporada: ${err.message || err}` },
      { status: 500 }
    );
  }
}
