"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from "@/lib/constants/roles";
import { api } from "@/lib/convex-generated";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { MenuButton } from "@/components/ui/menu-button";
import type { ProfileOverlayTab } from "../profiles/profile-overlay";

interface UserMenuProps {
  roleSlug: RoleKey;
  slug: string;
  onOpenOverlay?: (tab: ProfileOverlayTab) => void;
}

export function UserMenu({ roleSlug, slug: _slug, onOpenOverlay }: UserMenuProps) {
  const tNav = useTranslations("nav");
  const { user: clerkUser } = useUser();
  const { user: convexUser } = useCurrentUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const userRoles = useQuery(api.userRoles.myRoles);
  const roleConfigs = (userRoles ?? [])
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const displayName =
    convexUser?.businessName ||
    clerkUser?.fullName ||
    clerkUser?.username ||
    "…";
  const initials = displayName.slice(0, 2).toUpperCase();
  const subLabel = convexUser?.nickname ?? null;

  function handleMenuAction(tab: ProfileOverlayTab) {
    setOpen(false);
    onOpenOverlay?.(tab);
  }

  function handleSignOut() {
    setOpen(false);
    document.cookie = "dd-locale=; path=/; max-age=0";
    signOut({ redirectUrl: "/" });
  }

  return (
    <div className="relative">
      <button
        aria-label="User menu"
        onClick={() => setOpen((o) => !o)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
      >
        <span
          className="w-8 h-8 rounded-full flex items-center justify-center text-label font-medium" /* design-ok: visual circle inside 44px touch target */
          style={{
            background: "var(--color-primary)",
            color: "var(--color-text-on-primary)",
          }}
        >
          {initials}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[var(--z-dropdown)]"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-10 z-[var(--z-dropdown)] min-w-[180px] py-1 shadow-xl glass-elevated"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-glass-border)",
              borderRadius: "var(--border-radius)",
            }}
          >
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--color-glass-border)" }}
            >
              <p className="text-body font-medium truncate leading-tight text-primary">
                {displayName}
              </p>
              <p className={`text-label truncate leading-tight mt-0.5 text-secondary h-4 ${subLabel ? "opacity-100" : "opacity-0"}`}>
                {subLabel ?? "\u00A0"}
              </p>
            </div>

            <MenuButton
              variant="flush"
              onClick={() => handleMenuAction("profile")}
              className="w-full px-3"
            >
              <User size={14} />
              {tNav("profile")}
            </MenuButton>
            {roleConfigs.length > 1 && (
              <div
                className="mt-1 pt-1"
                style={{ borderTop: "1px solid var(--color-glass-border)" }}
              >
                {roleConfigs.map((role) => {
                  const Icon = role.icon;
                  return (
                    <MenuButton
                      key={role.key}
                      variant="flush"
                      onClick={() => handleMenuAction(`role:${role.key}`)}
                      className="w-full px-3"
                    >
                      <Icon size={14} />
                      {role.label}
                    </MenuButton>
                  );
                })}
              </div>
            )}

            <div
              className="mt-1"
              style={{ borderTop: "1px solid var(--color-glass-border)" }}
            >
              <MenuButton
                variant="flush"
                onClick={handleSignOut}
                className="w-full px-3"
              >
                <LogOut size={14} />
                {tNav("signOut")}
              </MenuButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
