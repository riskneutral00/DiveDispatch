import React from "react";

interface GlassLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/** Hyperlink-style action button. Use for low-hierarchy toggles and inline switches. */
export function GlassLink({ children, className = "", ...props }: GlassLinkProps) {
  return (
    <button
      type="button"
      className={[
        "text-xs underline underline-offset-2 text-left transition-opacity hover:opacity-70",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ color: "var(--color-accent)", fontFamily: "var(--font-body)" }}
      {...props}
    >
      {children}
    </button>
  );
}
