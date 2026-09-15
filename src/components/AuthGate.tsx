"use client";

import { useState } from "react";
import { useAuthSync } from "@/lib/useAuthSync";
import { signIn, signOut, signUp } from "@/lib/auth";
import { NavBar } from "./NavBar";

function AuthForm() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "signUp") {
        await signUp(username, password);
      } else {
        await signIn(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h1 className="text-lg font-semibold text-white mb-1">
          Port<span className="text-emerald-400">folio</span>
        </h1>
        <p className="text-xs text-neutral-500 mb-5">
          {mode === "signUp"
            ? "Create an account. Any data already in this browser will become your account's starting data."
            : "Sign in to your account."}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-400">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signUp" ? "new-password" : "current-password"}
              required
              minLength={6}
              className="rounded-md bg-neutral-950 border border-neutral-700 px-2.5 py-2 text-sm text-white"
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
          >
            {submitting ? "Please wait…" : mode === "signUp" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button
          onClick={() => {
            setMode((m) => (m === "signUp" ? "signIn" : "signUp"));
            setError(null);
          }}
          className="mt-4 text-xs text-neutral-500 hover:text-neutral-300 underline"
        >
          {mode === "signUp" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status, username } = useAuthSync();

  if (status === "checking") {
    return <div className="min-h-screen bg-neutral-950" />;
  }

  if (status === "anon") {
    return <AuthForm />;
  }

  return (
    <>
      <NavBar username={username} onSignOut={signOut} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      <footer className="text-center text-xs text-neutral-600 py-6">
        Data is stored in your account. Cached locally in your browser for
        offline use, but not shared with other accounts.
      </footer>
    </>
  );
}
