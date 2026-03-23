import React from "react";
import { Spinner } from "@/components/common/spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

const sizeMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-base gap-2",
  lg: "px-6 py-3 text-lg gap-2",
  icon: "p-2 text-sm",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--color-text-on-primary)",
    borderColor: "var(--color-primary)",
  },
  secondary: {
    background: "var(--color-glass-bg)",
    color: "var(--color-text-primary)",
    borderColor: "var(--color-glass-border)",
    backdropFilter: "blur(var(--glass-blur))",
    WebkitBackdropFilter: "blur(var(--glass-blur))",
  },
  ghost: {
    background: "transparent",
    color: "var(--color-text-primary)",
    borderColor: "transparent",
  },
  destructive: {
    background: "var(--color-destructive)",
    color: "#ffffff",
    borderColor: "var(--color-destructive)",
  },
  "destructive-ghost": {
    background: "transparent",
    color: "var(--color-text-secondary)",
    borderColor: "transparent",
  },
};

export function GlassButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  children,
  disabled,
  className = "",
  style,
  ...props
}: GlassButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center",
        "border font-medium leading-none",
        "rounded-[var(--border-radius)]",
        "transition-all",
        "glass-btn",
        `glass-btn-${variant}`,
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeMap[size],
        fullWidth && "w-full",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...variantStyles[variant],
        transitionDuration: "var(--transition-speed)",
        outlineColor: "var(--color-accent)",
        ...style,
      }}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
