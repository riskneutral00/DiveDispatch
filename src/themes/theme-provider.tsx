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

/** Bumped when bootstrap ThemeConfig shape changes (e.g. JPEG → gradient) so stale cache cannot reference removed assets. */
const CACHE_KEY = "divedispatch-theme-cache-v2";
const MODE_KEY = "divedispatch-theme-pref";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
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
  /** Increments on each user moon/sun toggle so we select the first skin for the new mode. */
  const [modeSwitchGeneration, setModeSwitchGeneration] = useState(0);
  /** null = pre-measure / SSR; responsive bg skins use small-screen `--bg-size` until set. */
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

  const prevVarsRef = useRef<Record<string, string> | null>(null);
  const lastPaletteSwitchGenerationRef = useRef(0);
  /** Flips to true after the first successful initial alignment; prevents the
   *  alignment effect from fighting user-driven mode toggles. */
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

  /** After a moon/sun toggle, apply the first skin in the new mode's list once (per toggle). */
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

  /** Initial load only: align mode to the selected theme's appearance.
   *  Runs once when Convex data first arrives, then yields all mode-driven
   *  skin changes to the modeSwitchGeneration effect above. */
  useEffect(() => {
    if (initialAlignmentDoneRef.current) return;
    if (!isAuthenticated || !mySkins?.length) return;
    if (selectedThemeDoc === undefined) return; // still loading

    // Missing or deleted theme → pick first skin for current mode
    if (!currentUser?.selectedThemeId || selectedThemeDoc === null) {
      const appearance = mode === "light" ? "light" : "dark";
      const bucket = mySkins.filter((t) => t.appearance === appearance);
      if (bucket.length > 0) {
        void selectThemeMutation({ themeId: bucket[0]._id });
      }
      initialAlignmentDoneRef.current = true;
      return;
    }

    // Theme exists — sync mode to its appearance ("theme wins" rule)
    const app = selectedThemeDoc.appearance;
    if (app === "light" || app === "dark") {
      if (app !== mode) {
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
