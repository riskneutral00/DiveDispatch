/**
 * Layout breakpoints — aligned with Tailwind defaults (`sm`, `md`, `lg`).
 * Must stay in sync with `--breakpoint-*` in `src/app/globals-theme.css` and
 * with `DEFAULT_RESPONSIVE_BREAKPOINT_PX` / hero skin logic in `theme-utils.ts`.
 */
export const BREAKPOINT_SM_PX = 640;
export const BREAKPOINT_MD_PX = 768;
export const BREAKPOINT_LG_PX = 1024;

/** For `max-width` queries meaning “only below Tailwind `sm`” (sm − 1 px). */
export const BREAKPOINT_BELOW_SM_PX = 639;
