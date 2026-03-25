"use client";

import { useEffect } from "react";
import { useCurrentUser } from "./use-current-user";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../constants/locales";

const COOKIE_NAME = "dd-locale";

/**
 * Syncs the authenticated user's preferred locale to the dd-locale cookie.
 * Reads appLanguage (preferred) or preferredLocale from the Convex user record.
 * When the cookie changes, the next server request picks up the new locale
 * via getRequestConfig in src/i18n/request.ts.
 */
export function useLocaleSync() {
  const { user } = useCurrentUser();

  useEffect(() => {
    if (!user) return;

    // appLanguage takes priority over preferredLocale (post DD-068)
    const rawLocale =
      (user as Record<string, unknown>).appLanguage as string | undefined
      ?? user.preferredLocale
      ?? DEFAULT_LOCALE;

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
    }
  }, [user]);
}
