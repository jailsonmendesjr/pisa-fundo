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

function loginErrorDestination(message: string) {
  const searchParams = new URLSearchParams({ error: message });
  return `/admin/login?${searchParams.toString()}`;
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
      shouldCreateUser: false,
    },
  });

  if (error) {
    redirect(loginErrorDestination(error.message));
  }

  redirect("/admin/login?sent=1");
}

export async function signInAdminWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const configuredEmail = getConfiguredAdminEmail();

  if (email !== configuredEmail || !password) {
    redirect(loginErrorDestination("E-mail ou senha inválidos."));
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(loginErrorDestination("E-mail ou senha inválidos."));
  }

  const { data: admin, error: adminError } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError || !admin) {
    await supabase.auth.signOut();
    redirect(loginErrorDestination("Esta conta não possui acesso administrativo."));
  }

  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login?signedOut=1");
}
