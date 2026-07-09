import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Aponta para a tabela real criada pelo Django
    const { data, error } = await supabase
      .from("championship_season")
      .select("id, name, year, is_active")
      .order("year", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mapeia os dados mantendo a estrutura esperada pelo Front-end
    const formattedSeasons = (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      year: s.year,
      isActive: s.is_active,
    }));

    return NextResponse.json(formattedSeasons);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}