import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/constants/locales";

type Messages = Record<string, unknown>;

function deepMerge(base: Messages, overlay: Messages): Messages {
  const result: Messages = { ...base };
  for (const [key, overlayValue] of Object.entries(overlay)) {
    const baseValue = result[key];
    if (
      overlayValue !== null &&
      typeof overlayValue === "object" &&
      !Array.isArray(overlayValue) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      result[key] = deepMerge(baseValue as Messages, overlayValue as Messages);
    } else {
      result[key] = overlayValue;
    }
  }
  return result;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const locale = resolveLocale(
    cookieStore.get("dd-locale")?.value,
    headerStore.get("accept-language") ?? undefined,
  );

  const enMessages = (await import("../../messages/en.json")).default as Messages;
  if (locale === "en") return { locale, messages: enMessages };

  const localeMessages = (await import(`../../messages/${locale}.json`)).default as Messages;
  const messages = deepMerge(enMessages, localeMessages);

  return { locale, messages };
});
