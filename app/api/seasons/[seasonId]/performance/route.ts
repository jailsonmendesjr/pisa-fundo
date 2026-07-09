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

    // Converte os IDs dos pilotos de string para number antes de chamar a lib
    const p1 = parseInt(p1Str, 10);
    const p2 = parseInt(p2Str, 10);

    if (isNaN(p1) || ...