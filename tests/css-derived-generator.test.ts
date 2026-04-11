import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { renderGlobalsStatusDerivedCss } from "@/themes/css-derived-tokens"

const DERIVED_PATH = path.resolve(
  __dirname,
  "../src/app/globals-status-derived.css",
)

describe("globals-status-derived.css generator", () => {
  it("committed file matches renderGlobalsStatusDerivedCss()", () => {
    const disk = fs.readFileSync(DERIVED_PATH, "utf-8")
    expect(disk).toBe(`${renderGlobalsStatusDerivedCss()}\n`)
  })
})
