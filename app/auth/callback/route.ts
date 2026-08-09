import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requestedNext = requestUrl.searchParams.get("next");
  const next =
    requestedNext === "/admin" ||
    requestedNext?.startsWith("/admin/") ||
    requestedNext?.startsWith("/admin?")
      ? requestedNext
      : "/admin";
  const supabase = await createServerSupabaseClient();

  let authError: Error | null = null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    authError = error;
  } else {
    authError = new Error("Link de acesso inválido ou incompleto.");
  }

  if (authError) {
    const loginUrl = new URL("/admin/login", requestUrl.origin);
    loginUrl.searchParams.set("error", authError.message);
    return noStoreRedirect(loginUrl);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    const loginUrl = new URL("/admin/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "Não foi possível validar sua conta.");
    return noStoreRedirect(loginUrl);
  }

  const normalizedEmail = user.email.toLowerCase();
  await supabase
    .from("app_admins")
    .update({
      user_id: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("email", normalizedEmail);

  const { data: admin } = await supabase
    .from("app_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!admin) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/admin/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "Esta conta não possui acesso administrativo.");
    return noStoreRedirect(loginUrl);
  }

  return noStoreRedirect(new URL(next, requestUrl.origin));
}
