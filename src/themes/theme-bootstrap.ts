export const THEME_MODE_STORAGE_KEY = "divedispatch-theme-pref";
export const THEME_CACHE_STORAGE_KEY = "divedispatch-theme-cache-v2";
export const THEME_VARS_STORAGE_KEY = "divedispatch-theme-vars-v1";
export const THEME_META_STORAGE_KEY = "divedispatch-theme-meta-v1";

export const BOOTSTRAP_DEFAULT_THEME_ID = "skin-light-4";
export const BOOTSTRAP_DEFAULT_MODE = "light";
export const BOOTSTRAP_DEFAULT_LUMINANCE = "bright";

export const BOOTSTRAP_APPLIED_VARS_GLOBAL = "__ddThemeBootstrapVars";

export interface ThemeMetaCache {
  id: string;
  luminance: "dark" | "medium" | "bright";
}

declare global {
  interface Window {
    [BOOTSTRAP_APPLIED_VARS_GLOBAL]?: Record<string, string>;
  }
}

export function applyThemeBootstrap(win: Window, doc: Document): void {
  try {
    const root = doc.documentElement;

    let mode: string | null = null;
    try {
      mode = win.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    } catch {}
    if (mode !== "dark" && mode !== "light") mode = BOOTSTRAP_DEFAULT_MODE;
    root.setAttribute("data-mode", mode);

    let themeId: string = BOOTSTRAP_DEFAULT_THEME_ID;
    let luminance: string = BOOTSTRAP_DEFAULT_LUMINANCE;
    try {
      const metaRaw = win.localStorage.getItem(THEME_META_STORAGE_KEY);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw) as Partial<ThemeMetaCache> | null;
        if (meta && typeof meta.id === "string") themeId = meta.id;
        if (
          meta &&
          (meta.luminance === "dark" ||
            meta.luminance === "medium" ||
            meta.luminance === "bright")
        ) {
          luminance = meta.luminance;
        }
      }
    } catch {}
    root.setAttribute("data-theme", themeId);
    root.setAttribute("data-luminance", luminance);

    try {
      const varsRaw = win.localStorage.getItem(THEME_VARS_STORAGE_KEY);
      if (varsRaw) {
        const parsed = JSON.parse(varsRaw) as unknown;
        if (parsed && typeof parsed === "object") {
          const vars = parsed as Record<string, unknown>;
          const applied: Record<string, string> = {};
          for (const key in vars) {
            if (Object.prototype.hasOwnProperty.call(vars, key)) {
              const value = vars[key];
              if (typeof value === "string") {
                root.style.setProperty(key, value);
                applied[key] = value;
              }
            }
          }
          if (Object.keys(applied).length > 0) {
            win[BOOTSTRAP_APPLIED_VARS_GLOBAL] = applied;
          }
        }
      }
    } catch {}
  } catch {}
}

export function getThemeBootstrapScript(): string {
  const MODE_K = JSON.stringify(THEME_MODE_STORAGE_KEY);
  const META_K = JSON.stringify(THEME_META_STORAGE_KEY);
  const VARS_K = JSON.stringify(THEME_VARS_STORAGE_KEY);
  const DEF_MODE = JSON.stringify(BOOTSTRAP_DEFAULT_MODE);
  const DEF_ID = JSON.stringify(BOOTSTRAP_DEFAULT_THEME_ID);
  const DEF_LUM = JSON.stringify(BOOTSTRAP_DEFAULT_LUMINANCE);
  const APPLIED_G = JSON.stringify(BOOTSTRAP_APPLIED_VARS_GLOBAL);

  return (
    "(function(w,d){try{var r=d.documentElement;" +
    `var m=null;try{m=w.localStorage.getItem(${MODE_K});}catch(e){}` +
    `if(m!=="dark"&&m!=="light")m=${DEF_MODE};r.setAttribute("data-mode",m);` +
    `var id=${DEF_ID},lum=${DEF_LUM};` +
    `try{var mr=w.localStorage.getItem(${META_K});if(mr){var md=JSON.parse(mr);` +
    `if(md&&typeof md.id==="string")id=md.id;` +
    `if(md&&(md.luminance==="dark"||md.luminance==="medium"||md.luminance==="bright"))lum=md.luminance;}}catch(e){}` +
    `r.setAttribute("data-theme",id);r.setAttribute("data-luminance",lum);` +
    `try{var vr=w.localStorage.getItem(${VARS_K});if(vr){var vs=JSON.parse(vr);` +
    `if(vs&&typeof vs==="object"){var ap={};for(var k in vs){` +
    `if(Object.prototype.hasOwnProperty.call(vs,k)){var v=vs[k];` +
    `if(typeof v==="string"){r.style.setProperty(k,v);ap[k]=v;}}}` +
    `if(Object.keys(ap).length>0)w[${APPLIED_G}]=ap;}}}catch(e){}` +
    "}catch(e){}})(window,document);"
  );
}
