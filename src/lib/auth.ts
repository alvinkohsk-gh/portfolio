import { supabase } from "./supabaseClient";
import { getSnapshot } from "./store";
import { PortfolioState } from "./types";

/** Supabase Auth needs a real email format, but this app's accounts are
 * username/password only - the user never sees or provides an email. A
 * deterministic fake address derived from the (normalized) username gets
 * real password hashing, sessions, and auth.uid()-based RLS for free
 * without building any of that by hand. */
const FAKE_EMAIL_DOMAIN = "users.portfolio-tracker.local";

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

function fakeEmail(username: string): string {
  return `${username}@${FAKE_EMAIL_DOMAIN}`;
}

/** Creates a new account and seeds it with `initialState` (the caller's
 * current local data) in one atomic server-side transaction, so a partial
 * failure never leaves an auth user with no profile/data row. */
export async function signUp(rawUsername: string, password: string) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) {
    throw new Error("Username must be 3-20 characters: letters, numbers, underscore only.");
  }

  const { error: signUpError } = await supabase.auth.signUp({
    email: fakeEmail(username),
    password,
    options: { data: { username } },
  });
  if (signUpError) throw signUpError;

  const { error: rpcError } = await supabase.rpc("claim_profile_and_seed", {
    p_username: username,
    p_state: getSnapshot(),
  });
  if (rpcError) {
    if (rpcError.code === "23505") throw new Error("Username already taken.");
    throw rpcError;
  }
}

export async function signIn(rawUsername: string, password: string) {
  const username = normalizeUsername(rawUsername);
  const { error } = await supabase.auth.signInWithPassword({
    email: fakeEmail(username),
    password,
  });
  if (error) throw new Error("Incorrect username or password.");
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function fetchRemoteState(): Promise<PortfolioState | null> {
  const { data, error } = await supabase
    .from("portfolio_data")
    .select("state")
    .maybeSingle();
  if (error) throw error;
  return (data?.state as PortfolioState) ?? null;
}

export async function pushRemoteState(state: PortfolioState) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("portfolio_data")
    .upsert({ user_id: user.id, state, updated_at: new Date().toISOString() });
  if (error) throw error;
}
