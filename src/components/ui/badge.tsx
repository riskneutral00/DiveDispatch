import React from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info" | "muted";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
  /** When provided, renders as interactive <button> with hover effects */
  onClick?: () => void;
  title?: string;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: "var(--color-glass-bg)",
    color: "var(--color-text-primary)",
    borderColor: "var(--color-glass-border)",
  },
  success: {
    background: "color-mix(in srgb, var(--color-success) 20%, transparent)",
    color: "var(--color-success)",
    borderColor: "color-mix(in srgb, var(--color-success) 30%, transparent)",
  },
  warning: {
    background: "color-mix(in srgb, var(--color-warning) 20%, transparent)",
    color: "var(--color-warning)",
    borderColor: "color-mix(in srgb, var(--color-warning) 30%, transparent)",
  },
  destructive: {
    background: "color-mix(in srgb, var(--color-destructive) 20%, transparent)",
    color: "var(--color-destructive)",
    borderColor: "color-mix(in srgb, var(--color-destructive) 30%, transparent)",
  },
  info: {
    background: "color-mix(in srgb, var(--color-secondary) 20%, transparent)",
    color: "var(--color-secondary)",
    borderColor: "color-mix(in srgb, var(--color-secondary) 30%, transparent)",
  },
  muted: {
    background: "var(--color-glass-bg)",
    color: "var(--color-text-secondary)",
    borderColor: "var(--color-glass-border)",
  },
};

const sizeMap: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs gap-1",
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

export const Badge = React.memo(function Badge({
  variant = "default",
  size = "md",
  dot = false,
  children,
  className = "",
  onClick,
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
        onClick && "cursor-pointer transition-all hover:brightness-125 hover:scale-105",
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
