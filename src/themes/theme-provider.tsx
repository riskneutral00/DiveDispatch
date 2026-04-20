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

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeConfig>(loadCachedTheme);
  const [mode, setModeState] = useState<ThemeMode>(loadCachedMode);
  const [modeSwitchGeneration, setModeSwitchGeneration] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  const { isAuthenticated } = useConvexAuth();
  const currentUser = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const themeConfig = useQuery(
    api.themes.getConfig,
    currentUser?.selectedThemeId ? { id: currentUser.selectedThemeId } : "skip",
  );
  const selectedThemeDoc = useQuery(
    api.themes.byId,
    isAuthenticated && currentUser?.selectedThemeId
      ? { id: currentUser.selectedThemeId }
      : "skip",
  );
  const mySkins = useQuery(
    api.themes.listMySkins,
    isAuthenticated ? {} : "skip",
  );
  const storeForMode = useMemo(() => {
    if (!isAuthenticated || !mySkins?.length) return undefined;
    const appearance = mode === "light" ? "light" : "dark";
    return mySkins.filter((t) => t.appearance === appearance);
  }, [isAuthenticated, mySkins, mode]);
  const selectThemeMutation = useMutation(api.themes.selectTheme);

  const prevVarsRef = useRef<Record<string, string> | null>(
    typeof window !== "undefined"
      ? window[BOOTSTRAP_APPLIED_VARS_GLOBAL] ?? null
      : null,
  );
  const lastPaletteSwitchGenerationRef = useRef(0);
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

  const isLoading = isAuthenticated
    ? !(themeConfig || (currentUser && !currentUser.selectedThemeId))
    : false;

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
    } catch {}
  }, [theme, mode, viewportWidth]);

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

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
    setModeSwitchGeneration((g) => g + 1);
  }, []);

  const selectTheme = useCallback(
    (themeId: string) => {
      if (isAuthenticated) {
        selectThemeMutation({ themeId: themeId as never });
      }
    },
    [isAuthenticated, selectThemeMutation],
  );

  useEffect(() => {
    if (!isAuthenticated || !storeForMode?.length) return;
    if (modeSwitchGeneration === 0) return;
    if (modeSwitchGeneration === lastPaletteSwitchGenerationRef.current) return;
    lastPaletteSwitchGenerationRef.current = modeSwitchGeneration;
    const firstId = storeForMode[0]._id;
    void selectThemeMutation({ themeId: firstId });
  }, [
    modeSwitchGeneration,
    storeForMode,
    isAuthenticated,
    selectThemeMutation,
  ]);

  useEffect(() => {
    if (initialAlignmentDoneRef.current) return;
    if (!isAuthenticated || !mySkins?.length) return;
    if (selectedThemeDoc === undefined) return;

    if (!currentUser?.selectedThemeId || selectedThemeDoc === null) {
      const appearance = mode === "light" ? "light" : "dark";
      const bucket = mySkins.filter((t) => t.appearance === appearance);
      if (bucket.length > 0) {
        void selectThemeMutation({ themeId: bucket[0]._id });
      }
      initialAlignmentDoneRef.current = true;
      return;
    }

    const app = selectedThemeDoc.appearance;
    if (app === "light" || app === "dark") {
      if (app !== mode) {
        /* eslint-disable-next-line react-hooks/set-state-in-effect -- comments-ok syncs local mode from server-side theme doc on initial alignment */
        setModeState(app);
        localStorage.setItem(MODE_KEY, app);
      }
      initialAlignmentDoneRef.current = true;
    }
  }, [
    isAuthenticated,
    mySkins,
    currentUser?.selectedThemeId,
    selectedThemeDoc,
    selectThemeMutation,
    mode,
  ]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode, selectTheme, isLoading }),
    [theme, mode, setMode, selectTheme, isLoading],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
