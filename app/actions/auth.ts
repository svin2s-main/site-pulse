"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { ok, fail, type ActionResponse } from "@/lib/action-result";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password is too long"),
});

/** The dashboard lives at the app root. */
const HOME_PATH = "/";

// ---------------------------------------------------------------------------
// signInAction
// ---------------------------------------------------------------------------

export async function signInAction(
  input: unknown,
): Promise<ActionResponse<{ email: string }>> {
  const parsed = credentialsSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Do not reveal whether the email exists; a generic message is safer.
    return fail("Invalid email or password");
  }

  revalidatePath(HOME_PATH);
  redirect(HOME_PATH);
}

// ---------------------------------------------------------------------------
// signUpAction
// ---------------------------------------------------------------------------

export async function signUpAction(
  input: unknown,
): Promise<ActionResponse<{ email: string; needsConfirmation: boolean }>> {
  const parsed = credentialsSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Confirmation emails (when enabled) return to our callback route, which
      // exchanges the one-time code for a session.
      emailRedirectTo: `${env.appUrl}/auth/callback`,
    },
  });

  if (error) {
    return fail(error.message);
  }

  // If email confirmation is enabled, no session is returned yet — inform the
  // user to check their inbox. Otherwise auto-login and redirect.
  const needsConfirmation = data.session === null;

  if (needsConfirmation) {
    return ok({ email: parsed.data.email, needsConfirmation: true });
  }

  revalidatePath(HOME_PATH);
  redirect(HOME_PATH);
}

// ---------------------------------------------------------------------------
// signOutAction
// ---------------------------------------------------------------------------

export async function signOutAction(): Promise<ActionResponse<undefined>> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return fail("Failed to sign out");
  }

  revalidatePath(HOME_PATH);
  redirect("/login");
}
