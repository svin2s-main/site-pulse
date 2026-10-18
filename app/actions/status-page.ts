"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, type ActionResponse } from "@/lib/action-result";
import {
  RESERVED_SLUGS,
  SLUG_MAX_LENGTH,
  SLUG_MIN_LENGTH,
  SLUG_PATTERN,
} from "@/lib/slug";
import type { StatusPageSummary } from "@/types/status-page";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/** Normalizes before validating so "My Page " and "My-Page" behave sensibly. */
const slugSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(SLUG_MIN_LENGTH, `Use at least ${SLUG_MIN_LENGTH} characters`)
    .max(SLUG_MAX_LENGTH, `Use at most ${SLUG_MAX_LENGTH} characters`)
    .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens"),
);

const saveStatusPageSchema = z.object({
  slug: slugSchema,
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title is too long"),
  isLive: z.boolean(),
});

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------------------
// saveStatusPageAction
// ---------------------------------------------------------------------------

/**
 * Creates or updates the signed-in user's public status page.
 *
 * The table allows one page per user (`user_id` is unique), so this is an
 * upsert keyed on `user_id`. Publishing is therefore an explicit, reversible
 * opt-in: `isLive` false means the public route returns 404 and the anonymous
 * RLS policies stop exposing the user's monitors and logs.
 */
export async function saveStatusPageAction(
  input: unknown,
): Promise<ActionResponse<StatusPageSummary>> {
  const parsed = saveStatusPageSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { slug, title, isLive } = parsed.data;

  if (RESERVED_SLUGS.has(slug)) {
    return fail("That public link is reserved — pick another one");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return fail("Unauthorized");
  }

  // Remember the previous slug so the page it used to live at is revalidated
  // (and does not keep serving stale HTML after a rename).
  const { data: existing } = await supabase
    .from("public_status_pages")
    .select("slug")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("public_status_pages")
    .upsert(
      {
        user_id: user.id,
        slug,
        title,
        is_live: isLive,
      },
      { onConflict: "user_id" },
    )
    .select("slug,title,is_live")
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return fail("That public link is already taken — try another slug");
    }
    return fail("Failed to save the status page");
  }

  revalidatePath("/");
  revalidatePath(`/status/${data.slug}`);
  if (existing && existing.slug !== data.slug) {
    revalidatePath(`/status/${existing.slug}`);
  }

  return ok({
    slug: data.slug,
    title: data.title,
    isLive: data.is_live,
  });
}
