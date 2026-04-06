import React from "react";
import { cn } from "@/lib/utils/cn";

interface ActionLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/** Hyperlink-style action button. Use for low-hierarchy toggles and inline switches. */
export function ActionLink({ children, className = "", ...props }: ActionLinkProps) {
  return (
    <button
      type="button"
      className={cn(
        "text-label underline underline-offset-2 text-left transition-opacity hover:opacity-70 text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
