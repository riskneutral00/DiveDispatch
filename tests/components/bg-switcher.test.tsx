// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockSelectTheme = vi.fn();
let mockSavedSkins: Array<{
  _id: string;
  name: string;
  slug: string;
  appearance: "dark" | "light" | undefined;
}> = [];

vi.mock("@/themes/theme-provider", () => ({
  useTheme: () => ({
    selectTheme: mockSelectTheme,
    mode: "dark" as const,
    savedSkins: mockSavedSkins,
    theme: { id: "a", name: "Skin A" },
  }),
}));

import { BgSwitcher } from "@/components/layout/bg-switcher";

describe("BgSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSavedSkins = [
      { _id: "a1", name: "Skin A", slug: "a", appearance: "dark" },
      { _id: "a2", name: "Skin B", slug: "b", appearance: "dark" },
      { _id: "a3", name: "Skin C", slug: "c", appearance: "light" },
    ];
  });

  it("disables the control when the filtered store list is empty", () => {
    mockSavedSkins = [];
    render(<BgSwitcher />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables the control when the appearance-filtered list has skins", () => {
    render(<BgSwitcher />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
