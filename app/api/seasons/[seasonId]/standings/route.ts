import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateStandings, getSeasonStandingsWithChanges } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: any }
) {
  try {
    // Forçar a resolução de params e conversão direta do ID para número inteiro
    const resolvedParams = await context.params;
    const seasonIdStr = resolvedParams.seasonId;

    if (!seasonIdStr) {
      return NextResponse.json(
        { error: "O parâmetro seasonId é obrigatório." },
        { status: 400 }
      );
    }

    const seasonId = parseInt(seasonIdStr, 10);

    if (isNaN(seasonId)) {
      return NextResponse.json(
        { error: "O parâmetro seasonId deve ser um número inteiro válido." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const compare = searchParams.get("compare") === "true";

    // Validar se a temporada existe no Supabase usando o ID Numérico
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

    // Agora o seasonId passa como number perfeitamente sem conflitos de tipo
    const standings = compare
      ? await getSeasonStandingsWithChanges(supabase, seasonId)
      : await calculateStandings(supabase, seasonId);

    return NextResponse.json(standings);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro interno no servidor: ${err.message || err}` },
      { status: 500 }
    );
  }
}

// Ajuste para git push e add
