import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getDriverPerformanceData } from "@/lib/standings";

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
    const p1 = searchParams.get("p1");
    const p2 = searchParams.get("p2");

    if (!p1 || !p2) {
      return NextResponse.json(
        { error: "Ambos os parâmetros p1 e p2 são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca os dados de performance para os dois pilotos
    const [p1Data, p2Data] = await Promise.all([
      getDriverPerformanceData(supabase, seasonId, p1),
      getDriverPerformanceData(supabase, seasonId, p2),
    ]);

    if (!p1Data || !p2Data) {
      return NextResponse.json(
        { error: "Um ou ambos os pilotos não foram encontrados nesta temporada." },
        { status: 404 }
      );
    }

    // Ajuste de cor se os dois pilotos forem da mesma equipe
    let adjustedP2Data = { ...p2Data };
    if (p1Data.teamColor === p2Data.teamColor) {
      adjustedP2Data.teamColor = "#3b82f6"; // Azul em caso de conflito de cor
    }

    return NextResponse.json({ p1: p1Data, p2: adjustedP2Data });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro ao buscar dados de performance: ${err.message || err}` },
      { status: 500 }
    );
  }
}
