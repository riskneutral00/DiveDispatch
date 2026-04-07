"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-current-user";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "../constants/locales";

const COOKIE_NAME = "dd-locale";

export function useLocaleSync() {
  const { user } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const rawLocale = user.appLanguage ?? DEFAULT_LOCALE;

    const supported: ReadonlyArray<string> = SUPPORTED_LOCALES;
    const locale = supported.includes(rawLocale) ? rawLocale : DEFAULT_LOCALE;

    const currentCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_NAME}=`))
      ?.split("=")[1];

    if (currentCookie !== locale) {
      document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    }
  }, [user, router]);
}
