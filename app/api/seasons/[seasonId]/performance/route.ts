import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDriverPerformanceData } from "@/lib/standings";
import { getErrorMessage } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ seasonId: string }> }
) {
  try {
    const resolvedParams = await context.params;
    const seasonId = parseInt(resolvedParams.seasonId, 10);

    if (isNaN(seasonId)) {
      return NextResponse.json(
        { error: "O parâmetro seasonId é obrigatório e deve ser um número inteiro válido." },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const p1Str = searchParams.get("p1");
    const p2Str = searchParams.get("p2");

    if (!p1Str) {
      return NextResponse.json(
        { error: "O parâmetro p1 é obrigatório na query string." },
        { status: 400 }
      );
    }

    // Converte os IDs dos pilotos de string para number de forma segura.
    // p2 é opcional para permitir a análise individual.
    const p1 = parseInt(p1Str, 10);
    const p2 = p2Str ? parseInt(p2Str, 10) : null;

    if (isNaN(p1) || (p2 !== null && isNaN(p2))) {
      return NextResponse.json(
        { error: "Os parâmetros p1 e p2 devem ser números inteiros válidos." },
        { status: 400 }
      );
    }

    if (p2 !== null && p1 === p2) {
      return NextResponse.json(
        { error: "Selecione pilotos diferentes para realizar a comparação." },
        { status: 400 }
      );
    }

    const [p1Data, p2Data] = await Promise.all([
      getDriverPerformanceData(supabase, seasonId, p1),
      p2 === null ? Promise.resolve(null) : getDriverPerformanceData(supabase, seasonId, p2),
    ]);

    if (!p1Data) {
      return NextResponse.json(
        { error: "Não foi possível encontrar os dados do piloto para esta temporada." },
        { status: 404 }
      );
    }

    if (p2 === null) {
      return NextResponse.json({ p1: p1Data });
    }

    if (!p2Data) {
      return NextResponse.json(
        { error: "Não foi possível encontrar os dados do segundo piloto para esta temporada." },
        { status: 404 }
      );
    }

    // Se ambos usam a mesma cor, mantém o segundo piloto visualmente distinguível.
    const finalP2Color = p1Data.teamColor === p2Data.teamColor ? "#2563eb" : p2Data.teamColor;

    return NextResponse.json({
      p1: p1Data,
      p2: {
        ...p2Data,
        teamColor: finalP2Color,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Erro ao buscar dados de performance: ${getErrorMessage(error)}` },
      { status: 500 }
    );
  }
}
