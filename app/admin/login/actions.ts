"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getConfiguredAdminEmail } from "@/lib/admin/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getRequestOrigin(headersList: Awaited<ReturnType<typeof headers>>) {
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");

  if (!host) {
    throw new Error("Não foi possível identificar a URL da aplicação.");
  }

  return `${protocol}://${host}`;
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const configuredEmail = getConfiguredAdminEmail();

  if (email !== configuredEmail) {
    redirect("/admin/login?sent=1");
  }

  const headersList = await headers();
  const origin = getRequestOrigin(headersList);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin/login?sent=1");
}

export async function signOutAdmin() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login?signedOut=1");
}
