import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { resolveLocale } from "../lib/constants/locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const cookieValue = cookieStore.get("dd-locale")?.value;
  const acceptLanguage = headerStore.get("accept-language") ?? undefined;

  const locale = resolveLocale(cookieValue, acceptLanguage);

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
