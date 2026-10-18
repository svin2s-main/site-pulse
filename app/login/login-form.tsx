"use client";

import { Suspense, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { signInAction, signUpAction } from "@/app/actions/auth";
import { CallbackNotice } from "./callback-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Client-side login/sign-up form. All authentication happens through the
 * Server Actions in `app/actions/auth.ts`, so there is one code path for
 * issuing the session and the browser never calls the Supabase SDK directly.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "sign-in" | "sign-up" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  const handleSignIn = () => {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        setPendingAction("sign-in");
        const result = await signInAction({ email, password });

        // On success the action redirects to the dashboard; only failures
        // return here.
        if (!result.success) {
          setError(result.error);
        }
      } finally {
        setPendingAction(null);
      }
    });
  };

  const handleSignUp = () => {
    setError(null);
    setInfo(null);

    startTransition(async () => {
      try {
        setPendingAction("sign-up");
        const result = await signUpAction({ email, password });

        if (!result.success) {
          setError(result.error);
          return;
        }

        if (result.data.needsConfirmation) {
          setInfo("Check your inbox to confirm your email, then sign in.");
          setPassword("");
        }
        // Otherwise the action already redirected to the dashboard.
      } finally {
        setPendingAction(null);
      }
    });
  };

  const busy = isPending || pendingAction !== null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Determine which submit button triggered the form from its `name` value.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    if (submitter?.name === "action-signup") {
      handleSignUp();
    } else {
      handleSignIn();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-indigo-500">
            <span className="text-lg font-bold text-white">D</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            DevPulse
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sign in or create an account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-6 backdrop-blur-md"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-medium text-zinc-300"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-medium text-zinc-300"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-500">
              {error}
            </p>
          )}
          {info && (
            <p role="status" className="text-xs font-medium text-emerald-400">
              {info}
            </p>
          )}
          <Suspense fallback={null}>
            <CallbackNotice />
          </Suspense>

          <div className="mt-1 flex flex-col gap-2">
            <Button
              type="submit"
              name="action-signin"
              className="w-full"
              disabled={busy}
            >
              {pendingAction === "sign-in" && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Sign In
            </Button>
            <Button
              type="submit"
              name="action-signup"
              variant="secondary"
              className="w-full"
              disabled={busy}
            >
              {pendingAction === "sign-up" && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              Sign Up
            </Button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-600">
          New here? Use Sign Up to create an account.
        </p>
      </div>
    </div>
  );
}
