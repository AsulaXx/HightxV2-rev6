// Helper to fetch the current user's Firebase ID token, or empty string if not signed in.
import { auth } from "@/lib/firebase";

export async function getIdToken(forceRefresh = false): Promise<string> {
  const u = auth?.currentUser;
  if (!u) return "";
  try {
    return await u.getIdToken(forceRefresh);
  } catch {
    return "";
  }
}
