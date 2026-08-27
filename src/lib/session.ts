import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Every data-touching API route calls this first. Returns the current
// user's DB id, or null if there's no valid session — callers should
// respond 401 in that case. Centralizing this one call is what makes it
// straightforward to audit that every route actually checks auth, instead
// of each route re-implementing (and potentially forgetting) the check.
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
