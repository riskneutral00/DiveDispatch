import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/constants/locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const locale = resolveLocale(
    cookieStore.get("dd-locale")?.value,
    headerStore.get("accept-language") ?? undefined,
  );

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
