import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export function getConfiguredAdminEmail() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!email) {
    throw new Error("ADMIN_EMAIL não está configurado no ambiente.");
  }

  return email;
}

export const getOptionalAdmin = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return null;
  }

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("email, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError || !admin) {
    return null;
  }

  return {
    supabase,
    userId,
    email: admin.email,
  };
});

export async function requireAdmin() {
  const admin = await getOptionalAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}
