import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  DEFAULT_LOCALE,
  resolveLocale,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "../locales";

describe("SUPPORTED_LOCALES", () => {
  it("includes all expected locales", () => {
    expect(SUPPORTED_LOCALES).toContain("en");
    expect(SUPPORTED_LOCALES).toContain("zh-CN");
    expect(SUPPORTED_LOCALES).toContain("zh-TW");
    expect(SUPPORTED_LOCALES).toContain("th");
    expect(SUPPORTED_LOCALES).toContain("fr");
    expect(SUPPORTED_LOCALES).toContain("ko");
  });

  it("has 'en' as DEFAULT_LOCALE", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});

describe("resolveLocale", () => {
  describe("cookie priority", () => {
    it("returns cookie value when it is a supported locale", () => {
      expect(resolveLocale("th", undefined)).toBe("th");
      expect(resolveLocale("zh-CN", undefined)).toBe("zh-CN");
      expect(resolveLocale("fr", "th,en;q=0.9")).toBe("fr");
    });

    it("ignores unsupported cookie and falls through to Accept-Language", () => {
      expect(resolveLocale("de", "fr,en;q=0.5")).toBe("fr");
    });

    it("ignores empty cookie", () => {
      expect(resolveLocale(undefined, "ko,en;q=0.5")).toBe("ko");
    });
  });

  describe("Accept-Language parsing", () => {
    it("returns highest quality supported locale", () => {
      expect(resolveLocale(undefined, "de,fr;q=0.8,en;q=0.5")).toBe("fr");
    });

    it("handles Accept-Language with no quality values", () => {
      expect(resolveLocale(undefined, "th")).toBe("th");
    });

    it("matches base language to full locale (fr-FR -> fr)", () => {
      expect(resolveLocale(undefined, "fr-FR")).toBe("fr");
    });

    it("matches base language to regional variant (zh -> zh-CN)", () => {
      expect(resolveLocale(undefined, "zh")).toBe("zh-CN");
    });

    it("falls back to default when no Accept-Language locale is supported", () => {
      expect(resolveLocale(undefined, "de,ja;q=0.9")).toBe("en");
    });

    it("falls back to default when Accept-Language is empty", () => {
      expect(resolveLocale(undefined, "")).toBe("en");
    });
  });

  describe("fallback", () => {
    it("returns default when both cookie and Accept-Language are undefined", () => {
      expect(resolveLocale(undefined, undefined)).toBe("en");
    });

    it("returns default for completely unsupported inputs", () => {
      expect(resolveLocale("xx", "yy,zz")).toBe("en");
    });
  });
});

describe("message files", () => {
  const messagesDir = path.resolve(__dirname, "../../../../messages");

  // Load en.json keys as the reference
  const enMessages = JSON.parse(
    fs.readFileSync(path.join(messagesDir, "en.json"), "utf-8"),
  );

  function getKeyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        keys.push(...getKeyPaths(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys.sort();
  }

  const enKeys = getKeyPaths(enMessages);

  const localeFiles: SupportedLocale[] = SUPPORTED_LOCALES.filter(
    (l) => l !== "en",
  ) as unknown as SupportedLocale[];

  it("en.json has keys", () => {
    expect(enKeys.length).toBeGreaterThan(0);
  });

  for (const locale of localeFiles) {
    it(`${locale}.json exists and parses as valid JSON`, () => {
      const filePath = path.join(messagesDir, `${locale}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it(`${locale}.json has identical key structure to en.json`, () => {
      const filePath = path.join(messagesDir, `${locale}.json`);
      const messages = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const localeKeys = getKeyPaths(messages);
      expect(localeKeys).toEqual(enKeys);
    });
  }
});
