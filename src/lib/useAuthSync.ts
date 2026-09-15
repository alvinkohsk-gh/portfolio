import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { fetchRemoteState, pushRemoteState } from "./auth";
import { clearAll, getSnapshot, migrate, replaceState, subscribe } from "./store";

export type AuthStatus = "checking" | "anon" | "authed";

const PUSH_DEBOUNCE_MS = 1000;

/** Bridges the existing localStorage-backed store to a per-account Supabase
 * row. Deliberately does not touch any store action or page - it just pulls
 * the account's remote state through the existing `replaceState()` on
 * login, and pushes local changes back through the existing `getSnapshot()`
 * + `subscribe()` mechanism every other part of the app already relies on. */
export function useAuthSync() {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [username, setUsername] = useState<string | null>(null);
  const suppressNextPush = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function pullRemoteAndApply() {
      const remote = await fetchRemoteState();
      if (cancelled) return;
      if (remote) {
        suppressNextPush.current = true;
        replaceState(migrate(remote));
      }
    }

    async function handleSession(session: { user: { user_metadata?: { username?: string } } } | null) {
      if (!session) {
        setStatus("anon");
        setUsername(null);
        return;
      }
      setUsername(session.user.user_metadata?.username ?? null);
      await pullRemoteAndApply();
      if (!cancelled) setStatus("authed");
    }

    supabase.auth.getSession().then(({ data }) => handleSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAll();
        setStatus("anon");
        setUsername(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        handleSession(session);
      }
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (status !== "authed") return;

    const flush = () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = null;
      pushRemoteState(getSnapshot()).catch(() => {
        // Best-effort - the next local change (or reconnect) will retry.
      });
    };

    const unsubscribe = subscribe(() => {
      if (suppressNextPush.current) {
        suppressNextPush.current = false;
        return;
      }
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(flush, PUSH_DEBOUNCE_MS);
    });

    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("online", flush);

    return () => {
      unsubscribe();
      if (pushTimer.current) clearTimeout(pushTimer.current);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("online", flush);
    };
  }, [status]);

  return { status, username };
}
