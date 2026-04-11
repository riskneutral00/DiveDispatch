import { describe, it, expect } from "vitest"
import {
  BREAKPOINT_BELOW_SM_PX,
  BREAKPOINT_MD_PX,
  BREAKPOINT_SM_PX,
} from "../src/themes/breakpoints"
import { DEFAULT_RESPONSIVE_BREAKPOINT_PX } from "../src/themes/theme-utils"
import { readGlobalsCssBundle } from "./helpers/globals-css-bundle"

describe("breakpoints.ts", () => {
  it("matches Tailwind default sm/md scale", () => {
    expect(BREAKPOINT_SM_PX).toBe(640)
    expect(BREAKPOINT_MD_PX).toBe(768)
    expect(BREAKPOINT_BELOW_SM_PX).toBe(BREAKPOINT_SM_PX - 1)
  })

  it("hero responsive bg default matches md (single story with desktop chrome)", () => {
    expect(DEFAULT_RESPONSIVE_BREAKPOINT_PX).toBe(BREAKPOINT_MD_PX)
  })

  it("globals-theme :root defines CSS vars with same px as breakpoints.ts", () => {
    const bundle = readGlobalsCssBundle()
    expect(bundle).toContain(`--breakpoint-sm: ${BREAKPOINT_SM_PX}px`)
    expect(bundle).toContain(`--breakpoint-md: ${BREAKPOINT_MD_PX}px`)
    expect(bundle).toContain(`--breakpoint-below-sm: ${BREAKPOINT_BELOW_SM_PX}px`)
  })
})
