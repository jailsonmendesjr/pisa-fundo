import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data: seasons, error } = await supabase
      .from("seasons")
      .select("id, name, year, is_active")
      .order("year", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Erro ao buscar temporadas do Supabase: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(seasons);
  } catch (err: any) {
    return NextResponse.json(
      { error: `Erro interno no servidor: ${err.message || err}` },
      { status: 500 }
    );
  }
}
