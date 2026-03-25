"use client";

import { useLocaleSync } from "./use-locale-sync";

/**
 * Client component that mounts the locale sync hook.
 * Place inside the ConvexClerkProvider so useCurrentUser has access to auth + Convex.
 */
export function LocaleSyncProvider({ children }: { children: React.ReactNode }) {
  useLocaleSync();
  return <>{children}</>;
}
