import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDriverPerformanceData } from "@/lib/standings";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: any }
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

    if (!p1Str || !p2Str) {
      return NextResponse.json(
        { error: "Os parâmetros p1 e p2 são obrigatórios na query string." },
        { status: 400 }
      );
    }

    // Converte os IDs dos pilotos de string para number de forma segura
    const p1 = parseInt(p1Str, 10);
    const p2 = parseInt(p2Str, 10);

    if (isNaN(p1) || isNaN(p2)) {
      return NextResponse.json(
        { error: "Os parâmetros p1 e p2 devem ser números inteiros válidos." },
        { status: 400 }
      );
    }

    // Busca os dados de performance para os dois pilotos de forma concorrente
    const [p1Data, p2Data] = await Promise.all([
      getDriverPerformanceData(supabase, seasonId, p1),
      getDriverPerformanceData(supabase, seasonId, p2),
    ]);

    if (!p1Data || !p2Data) {
      return NextResponse.json(
        { error: "Não foi possível encontrar os dados de um ou ambos os pilotos para esta temporada." },
        { status: 404 }
      );
    }

    // Ajuste estratégico de cor se os dois pilotos forem da mesma equipe
    let finalP2Color = p2Data.teamColor;
    if (p1Data.teamColor === p2Data.teamColor) {
      finalP2Color = "#2563eb"; // Força um tom azul para distinguir nos gráficos
    }

    return NextResponse.json({
      p1: p1Data,
      p2: {
        ...p2Data,
        teamColor: finalP2Color,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro ao buscar performance comparativa: ${err.message || err}` },
      { status: 500 }
    );
  }
}

// Ajuste para git push