import React from "react";
import { cn } from "@/lib/utils/cn";
import { INTERACTION_DEFAULTS, type BadgeHoverEffect } from "@/lib/constants/interaction-config";

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info" | "muted";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  onClick?: () => void;
  hoverEffect?: BadgeHoverEffect;
  title?: string;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: "var(--color-glass-bg)",
    color: "var(--color-text-primary)",
    borderColor: "var(--color-glass-border)",
  },
  success: {
    background: "var(--color-badge-success-bg)",
    color: "var(--color-success)",
    borderColor: "var(--color-badge-success-border)",
  },
  warning: {
    background: "var(--color-badge-warning-bg)",
    color: "var(--color-warning)",
    borderColor: "var(--color-badge-warning-border)",
  },
  destructive: {
    background: "var(--color-badge-destructive-bg)",
    color: "var(--color-destructive)",
    borderColor: "var(--color-badge-destructive-border)",
  },
  info: {
    background: "var(--color-badge-info-bg)",
    color: "var(--color-secondary)",
    borderColor: "var(--color-badge-info-border)",
  },
  muted: {
    background: "var(--color-glass-bg)",
    color: "var(--color-text-secondary)",
    borderColor: "var(--color-glass-border)",
  },
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-label gap-1",
  md: "px-2.5 py-1 text-body gap-1.5",
};

const dotColorVar: Record<BadgeVariant, string> = {
  default: "var(--color-text-secondary)",
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  destructive: "var(--color-destructive)",
  info: "var(--color-secondary)",
  muted: "var(--color-text-secondary)",
};

const HOVER_CLASS: Record<BadgeHoverEffect, string> = {
  "glass-glow": "glass-btn glass-btn-ghost",
  opacity: "transition-opacity duration-theme hover:opacity-70",
  none: "",
};

export const Badge = React.memo(function Badge({
  variant = "default",
  size = "md",
  dot = false,
  children,
  className = "",
  onClick,
  hoverEffect = INTERACTION_DEFAULTS.badgeHover,
  title,
}: BadgeProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      title={title}
      className={cn(
        "inline-flex items-center border font-medium",
        "rounded-full",
        sizeMap[size],
        onClick && `cursor-pointer ${HOVER_CLASS[hoverEffect]}`,
        className,
      )}
      style={variantStyles[variant]}
    >
      {dot && (
        <span
          className="inline-block rounded-full flex-shrink-0"
          style={{
            width: size === "sm" ? "5px" : "6px",
            height: size === "sm" ? "5px" : "6px",
            background: dotColorVar[variant],
            boxShadow: `0 0 6px ${dotColorVar[variant]}`,
          }}
        />
      )}
      {children}
    </Tag>
  );
})
