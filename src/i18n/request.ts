import { cookies, headers } from "next/headers";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "@/lib/constants/locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const locale = resolveLocale(
    cookieStore.get("dd-locale")?.value,
    headerStore.get("accept-language") ?? undefined,
  );

  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  const messages = JSON.parse(await readFile(file, "utf-8"));

  return { locale, messages };
});
