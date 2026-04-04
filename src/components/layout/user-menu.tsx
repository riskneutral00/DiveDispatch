"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { LogOut, Settings, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ROLE_BY_CLERK_ROLE, type ClerkRole, type RoleKey } from "@/lib/constants/roles";
import { api } from "@/lib/convex-generated";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import type { ProfileOverlayTab } from "../profiles/profile-overlay";

interface UserMenuProps {
  roleSlug: RoleKey;
  slug: string;
  onOpenOverlay?: (tab: ProfileOverlayTab) => void;
}

export function UserMenu({ roleSlug, slug, onOpenOverlay }: UserMenuProps) {
  const tNav = useTranslations("nav");
  const tUserMenu = useTranslations("userMenu");
  const { user: clerkUser } = useUser();
  const { user: convexUser } = useCurrentUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const userRoles = useQuery(api.userRoles.myRoles);
  const roleConfigs = (userRoles ?? [])
    .map((r) => ROLE_BY_CLERK_ROLE[r.role as ClerkRole])
    .filter(Boolean);

  // Close on Escape key
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
    // Clear locale cookie on sign-out so unauthenticated users default to Accept-Language
    document.cookie = "dd-locale=; path=/; max-age=0";
    signOut({ redirectUrl: "/" });
  }

  return (
    <div className="relative">
      <button
        aria-label="User menu"
        onClick={() => setOpen((o) => !o)}
        className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{
          background: "var(--color-primary)",
          color: "var(--color-text-on-primary)",
        }}
      >
        {initials}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-10 z-50 min-w-[180px] py-1 shadow-xl"
            style={{
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-glass-border)",
              backdropFilter: "blur(var(--glass-blur))",
              WebkitBackdropFilter: "blur(var(--glass-blur))",
              borderRadius: "var(--border-radius)",
            }}
          >
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--color-glass-border)" }}
            >
              <p className="text-sm font-medium truncate leading-tight text-primary">
                {displayName}
              </p>
              <p className={`text-xs truncate leading-tight mt-0.5 text-secondary h-4 ${subLabel ? "opacity-100" : "opacity-0"}`}>
                {subLabel ?? "\u00A0"}
              </p>
            </div>

            {roleConfigs.length > 1 ? (
              roleConfigs.map((role) => {
                const Icon = role.icon;
                return (
                  <div key={role.key}>
                    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                      <Icon size={14} className="text-secondary" />
                      <span className="text-xs font-medium text-secondary">{role.label}</span>
                    </div>
                    <button
                      onClick={() => handleMenuAction(`role:${role.key}`)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 pl-9 text-sm transition-all cursor-pointer text-secondary"
                    >
                      <User size={12} />
                      {tNav("profile")}
                    </button>
                    <button
                      onClick={() => handleMenuAction("preferences")}
                      className="flex items-center gap-2 w-full px-3 py-1.5 pl-9 text-sm transition-all cursor-pointer text-secondary"
                    >
                      <Settings size={12} />
                      {tUserMenu("preferences")}
                    </button>
                  </div>
                );
              })
            ) : (
              <>
                <button
                  onClick={() => handleMenuAction("profile")}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer text-secondary"
                >
                  <User size={14} />
                  {tNav("profile")}
                </button>
                <button
                  onClick={() => handleMenuAction("preferences")}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer text-secondary"
                >
                  <Settings size={14} />
                  {tUserMenu("preferences")}
                </button>
              </>
            )}

            <div
              className="mt-1"
              style={{ borderTop: "1px solid var(--color-glass-border)" }}
            >
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all cursor-pointer text-secondary"
              >
                <LogOut size={14} />
                {tNav("signOut")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
