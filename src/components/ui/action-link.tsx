import React from "react";
import { cn } from "@/lib/utils/cn";

interface ActionLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function ActionLink({ children, className = "", ...props }: ActionLinkProps) {
  return (
    <button
      type="button"
      className={cn(
        "text-label underline underline-offset-2 text-left transition-opacity duration-theme hover:opacity-70 text-accent",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
