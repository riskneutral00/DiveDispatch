"use client";

import { useLocaleSync } from "./use-locale-sync";

export function LocaleSyncProvider({ children }: { children: React.ReactNode }) {
  useLocaleSync();
  return <>{children}</>;
}
