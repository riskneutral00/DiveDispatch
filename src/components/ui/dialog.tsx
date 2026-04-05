"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ── Types ────────────────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Full-screen variant: full viewport on mobile, 90vw×90vh (max 800px) on desktop */
  fullScreen?: boolean;
  /** When true, content behind the dialog fades out — dialog floats alone on background.
   *  Default false — content stays visible behind the blurred backdrop. */
  scrim?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  fullScreen = false,
  scrim = false,
  className = "",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  // Manage native <dialog> open/close.
  // Scroll lock and content fade are handled by CSS:
  //   body:has(dialog[open]) { overflow: hidden }
  //   html:has(dialog[open]) .app-shell { opacity: 0 }
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    // Cleanup: ensure dialog is closed if component unmounts while open
    // (e.g. error boundary mid-render) so CSS :has(dialog[open]) clears
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  // Close on backdrop click
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  // Close on Escape (dialog handles natively; sync state)
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  if (!open) return null;

  if (fullScreen) {
    return (
      <dialog
        ref={dialogRef}
        onClick={handleClick}
        onCancel={handleCancel}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-modal="true"
        data-scrim={scrim || undefined}
        className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[var(--z-modal)]"
        style={{ border: "none" }}
      >
        <div
          className="flex h-full items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div
            className={cn(
              "glass-container flex flex-col shadow-2xl",
              "w-full h-full rounded-none",
              "sm:w-[90vw] sm:h-[90vh] sm:max-w-[800px] sm:rounded-[var(--border-radius,12px)]",
              "overflow-hidden",
              className,
            )}
            style={{ backgroundColor: "var(--color-surface-elevated)" }}
          >
            <div
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0 border-b"
              style={{ borderColor: "var(--color-glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-semibold leading-tight text-primary"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-md transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 text-secondary"
                style={{ outlineColor: "var(--color-accent)" }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      </dialog>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      onCancel={handleCancel}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-modal="true"
      data-scrim={scrim || undefined}
      className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[var(--z-modal)]"
      style={{ border: "none" }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            "glass-container w-full shadow-2xl",
            sizeMap[size],
            className,
          )}
          style={{ backgroundColor: "var(--color-surface-elevated)" }}
        >
          {(title || description) && (
            <div
              className="flex items-start justify-between gap-4 p-4 sm:p-6 border-b"
              style={{ borderColor: "var(--color-glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-semibold leading-tight text-primary"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-md transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 text-secondary"
                style={{ outlineColor: "var(--color-accent)" }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
