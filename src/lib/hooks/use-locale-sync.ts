"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-current-user";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../constants/locales";

const COOKIE_NAME = "dd-locale";

/**
 * Syncs the authenticated user's preferred locale to the dd-locale cookie.
 * Reads appLanguage from the Convex user record.
 * When the cookie changes, triggers a router.refresh() to re-run SSR with the new locale.
 */
export function useLocaleSync() {
  const { user } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const rawLocale = user.appLanguage ?? DEFAULT_LOCALE;

    const supported: ReadonlyArray<string> = SUPPORTED_LOCALES;
    const locale = supported.includes(rawLocale) ? rawLocale : DEFAULT_LOCALE;

    // Read current cookie
    const currentCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split("=")[1];

    if (currentCookie !== locale) {
      // Set cookie with 1 year expiry, path=/ so the server can read it
      document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      // Refresh to re-run SSR with the corrected cookie, preventing locale flicker
      router.refresh();
    }
  }, [user, router]);
}
