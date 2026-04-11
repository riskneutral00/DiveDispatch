/**
 * themes.listStoreByAppearance — filtered store list by palette bucket
 */

import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeT } from "./helpers/convex-helpers";

const MIN_CONFIG = JSON.stringify({ id: "t1", name: "T1" });

describe("themes.listStoreByAppearance", () => {
  it("returns active themes for the given appearance in canonical slug order", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("themes", {
        name: "D1",
        slug: "d1",
        config: MIN_CONFIG,
        isActive: true,
        createdAt: 100,
        appearance: "dark",
      });
      await ctx.db.insert("themes", {
        name: "D2",
        slug: "d2",
        config: MIN_CONFIG,
        isActive: true,
        createdAt: 200,
        appearance: "dark",
      });
      await ctx.db.insert("themes", {
        name: "L1",
        slug: "l1",
        config: MIN_CONFIG,
        isActive: true,
        createdAt: 50,
        appearance: "light",
      });
    });

    const dark = await t.query(api.themes.listStoreByAppearance, {
      appearance: "dark",
    });
    expect(dark).toHaveLength(2);
    expect(dark[0].slug).toBe("d1");
    expect(dark[1].slug).toBe("d2");

    const light = await t.query(api.themes.listStoreByAppearance, {
      appearance: "light",
    });
    expect(light).toHaveLength(1);
    expect(light[0].slug).toBe("l1");
  });

  it("excludes rows missing appearance from indexed bucket queries", async () => {
    const t = makeT();
    await t.run(async (ctx) => {
      await ctx.db.insert("themes", {
        name: "Legacy",
        slug: "legacy",
        config: MIN_CONFIG,
        isActive: true,
        createdAt: 10,
      });
      await ctx.db.insert("themes", {
        name: "Tagged",
        slug: "tagged",
        config: MIN_CONFIG,
        isActive: true,
        createdAt: 20,
        appearance: "dark",
      });
    });

    const dark = await t.query(api.themes.listStoreByAppearance, {
      appearance: "dark",
    });
    expect(dark).toHaveLength(1);
    expect(dark[0].slug).toBe("tagged");
  });
});
