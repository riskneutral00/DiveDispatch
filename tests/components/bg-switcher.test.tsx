// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUseQuery = vi.fn();
const mockSelectTheme = vi.fn();

vi.mock("convex/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("convex/react")>();
  return {
    ...actual,
    useQuery: (q: unknown, args: unknown) => mockUseQuery(q, args),
    useConvexAuth: () => ({ isAuthenticated: true }),
  };
});

vi.mock("@/themes/theme-provider", () => ({
  useTheme: () => ({
    selectTheme: mockSelectTheme,
    mode: "dark" as const,
  }),
}));

import { BgSwitcher } from "@/components/layout/bg-switcher";

describe("BgSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockImplementation((_q, args) => {
      if (args === "skip") return undefined;
      return [
        { _id: "a1", name: "Skin A", slug: "a", appearance: "dark" },
        { _id: "a2", name: "Skin B", slug: "b", appearance: "dark" },
        { _id: "a3", name: "Skin C", slug: "c", appearance: "light" },
      ];
    });
  });

  it("disables the control when the filtered store list is empty", () => {
    mockUseQuery.mockReturnValue([]);
    render(<BgSwitcher />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables the control when the appearance-filtered list has skins", () => {
    render(<BgSwitcher />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
