"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-generated";
import { loadGoogleFonts } from "./theme-loader";
import { BOOTSTRAP_FALLBACK_THEME } from "./default-themes";
import { ThemeConfig, ThemeContextValue, ThemeMode } from "./theme-types";
import {
  clearInjectedVars,
  injectVars,
  mergeResponsiveBackgroundSizeIntoVars,
  resolveThemePalette,
  themeToVars,
} from "./theme-utils";
import {
  BOOTSTRAP_APPLIED_VARS_GLOBAL,
  THEME_CACHE_STORAGE_KEY as CACHE_KEY,
  THEME_META_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY as MODE_KEY,
  THEME_VARS_STORAGE_KEY,
  type ThemeMetaCache,
} from "./theme-bootstrap";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>"); // error-ok
  }
  return ctx;
}

function loadCachedTheme(): ThemeConfig {
  if (typeof window === "undefined") return BOOTSTRAP_FALLBACK_THEME;
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return BOOTSTRAP_FALLBACK_THEME;

  try {
    return JSON.parse(raw) as ThemeConfig;
  } catch {
    return BOOTSTRAP_FALLBACK_THEME;
  }
}

function loadCachedMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(MODE_KEY);
  if (stored === "dark") return "dark";
  return "light";
}

const PER_ID_VARS_KEY = "divedispatch-theme-vars-by-id-v1";

interface CachedThemeAppearance {
  vars: Record<string, string>;
  themeSlug: string;
  mode: ThemeMode;
  luminance: "dark" | "medium" | "bright";
}

function readVarsForThemeId(themeId: string): CachedThemeAppearance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PER_ID_VARS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, CachedThemeAppearance>;
    return cache[themeId] ?? null;
  } catch {
    return null;
  }
}

function writeVarsForThemeId(
  themeId: string,
  value: CachedThemeAppearance,
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PER_ID_VARS_KEY);
    const cache: Record<string, CachedThemeAppearance> = raw
      ? JSON.parse(raw)
      : {};
    cache[themeId] = value;
    localStorage.setItem(PER_ID_VARS_KEY, JSON.stringify(cache));
  } catch {
    void 0;
  }
}

function paintFromCache(themeId: string): boolean {
  if (typeof window === "undefined") return false;
  const cached = readVarsForThemeId(themeId);
  if (!cached) return false;
  injectVars(cached.vars);
  const root = document.documentElement;
  root.setAttribute("data-theme", cached.themeSlug);
  root.setAttribute("data-mode", cached.mode);
  root.setAttribute("data-luminance", cached.luminance);
  return true;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(loadCachedTheme);
  const [mode, setModeState] = useState<ThemeMode>(loadCachedMode);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const themeData = useQuery(
    api.themes.myThemeContext,
    isAuthenticated ? {} : "skip",
  );
  const currentUser = themeData?.user;
  const themeConfig = themeData?.selectedTheme as
    | ThemeConfig
    | null
    | undefined;
  const selectedThemeAppearance = themeData?.selectedThemeAppearance;
  const mySkins = themeData?.savedSkins;
  const selectThemeMutation = useMutation(api.themes.selectTheme);

  const prevVarsRef = useRef<Record<string, string> | null>(
    typeof window !== "undefined"
      ? window[BOOTSTRAP_APPLIED_VARS_GLOBAL] ?? null
      : null,
  );
  const initialAlignmentDoneRef = useRef(false);

  const [prevThemeConfig, setPrevThemeConfig] = useState(themeConfig);
  if (themeConfig && themeConfig !== prevThemeConfig) {
    setPrevThemeConfig(themeConfig);
    setThemeState(themeConfig as ThemeConfig);
  }

  useEffect(() => {
    if (themeConfig) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(themeConfig));
    }
  }, [themeConfig]);

  const isLoading = isAuthenticated && themeData === undefined;

  useLayoutEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok reads window.innerWidth on mount; SSR-safe (needs client) */
    setViewportWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => setViewportWidth(window.innerWidth), 100);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const vars = { ...themeToVars(theme) };
    mergeResponsiveBackgroundSizeIntoVars(vars, theme, viewportWidth);

    if (prevVarsRef.current) {
      const stale = Object.keys(prevVarsRef.current).filter(
        (k) => !(k in vars),
      );
      if (stale.length > 0) {
        const toRemove = Object.fromEntries(stale.map((k) => [k, ""]));
        clearInjectedVars(toRemove);
      }
    }

    injectVars(vars);
    prevVarsRef.current = vars;

    document.documentElement.setAttribute("data-theme", theme.id);
    document.documentElement.setAttribute("data-mode", mode);

    const palette = resolveThemePalette(theme);
    document.documentElement.setAttribute(
      "data-luminance",
      palette.luminanceClass,
    );

    document.documentElement.removeAttribute("data-hover-effect");

    try {
      localStorage.setItem(THEME_VARS_STORAGE_KEY, JSON.stringify(vars));
      const meta: ThemeMetaCache = {
        id: theme.id,
        luminance: palette.luminanceClass,
      };
      localStorage.setItem(THEME_META_STORAGE_KEY, JSON.stringify(meta));
      if (currentUser?.selectedThemeId) {
        writeVarsForThemeId(currentUser.selectedThemeId, {
          vars,
          themeSlug: theme.id,
          mode,
          luminance: palette.luminanceClass,
        });
      }
    } catch {}
  }, [theme, mode, viewportWidth, currentUser?.selectedThemeId]);

  useEffect(() => {
    loadGoogleFonts(theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (prevVarsRef.current) {
        clearInjectedVars(prevVarsRef.current);
      }
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.removeAttribute("data-mode");
      document.documentElement.removeAttribute("data-luminance");
    };
  }, []);

  const selectTheme = useCallback(
    (themeId: string) => {
      if (!isAuthenticated) return;
      paintFromCache(themeId);
      selectThemeMutation({ themeId: themeId as never });
    },
    [isAuthenticated, selectThemeMutation],
  );

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      localStorage.setItem(MODE_KEY, next);
      if (!isAuthenticated || !mySkins?.length) return;
      const target = mySkins.find((t) => t.appearance === next);
      if (!target) return;
      paintFromCache(target._id);
      selectThemeMutation({ themeId: target._id as never });
    },
    [isAuthenticated, mySkins, selectThemeMutation],
  );

  useEffect(() => {
    if (initialAlignmentDoneRef.current) return;
    if (!isAuthenticated || !mySkins?.length) return;
    if (themeData === undefined) return;

    if (!currentUser?.selectedThemeId || selectedThemeAppearance === null) {
      const appearance = mode === "light" ? "light" : "dark";
      const bucket = mySkins.filter((t) => t.appearance === appearance);
      if (bucket.length > 0) {
        void selectThemeMutation({ themeId: bucket[0]._id });
      }
      initialAlignmentDoneRef.current = true;
      return;
    }

    if (
      selectedThemeAppearance === "light" ||
      selectedThemeAppearance === "dark"
    ) {
      if (selectedThemeAppearance !== mode) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok syncs local mode from server-side theme appearance on initial alignment */
        setModeState(selectedThemeAppearance);
        localStorage.setItem(MODE_KEY, selectedThemeAppearance);
      }
      initialAlignmentDoneRef.current = true;
    }
  }, [
    isAuthenticated,
    mySkins,
    currentUser?.selectedThemeId,
    themeData,
    selectedThemeAppearance,
    selectThemeMutation,
    mode,
  ]);

  const savedSkins = mySkins ?? [];
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode, selectTheme, isLoading, savedSkins }),
    [theme, mode, setMode, selectTheme, isLoading, savedSkins],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
