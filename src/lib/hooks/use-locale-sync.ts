"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "./use-current-user";
import { normalizeLocale } from "../constants/locales";

const COOKIE_NAME = "dd-locale";

export function useLocaleSync() {
  const { user } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    const locale = normalizeLocale(user.appLanguage);

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
