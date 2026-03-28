"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

// ── Ref-counted backdrop content fade ────────────────────────────────────────
// When any GlassDialog is open, [data-dialog-open] is set on <html> so CSS can
// fade .app-shell content to zero, revealing the brand background (Glass Air).
// Ref-counted so nested dialogs don't flash content on inner close.

let dialogOpenCount = 0;

function incrementDialogOpen() {
  dialogOpenCount++;
  document.documentElement.setAttribute("data-dialog-open", "");
}

function decrementDialogOpen() {
  dialogOpenCount = Math.max(0, dialogOpenCount - 1);
  if (dialogOpenCount === 0) {
    document.documentElement.removeAttribute("data-dialog-open");
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Full-screen variant: full viewport on mobile, 90vw×90vh (max 800px) on desktop */
  fullScreen?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function GlassDialog({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  fullScreen = false,
  className = "",
}: GlassDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  // Manage native <dialog> open/close + manual scroll lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Ref-counted backdrop content fade
  useEffect(() => {
    if (!open) return;
    incrementDialogOpen();
    return () => decrementDialogOpen();
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
        className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[9999]"
        style={{ border: "none" }}
      >
        <div
          className="flex h-full items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div
            className={[
              "glass-container flex flex-col shadow-2xl",
              "w-full h-full rounded-none",
              "sm:w-[90vw] sm:h-[90vh] sm:max-w-[800px] sm:rounded-[var(--border-radius,12px)]",
              "overflow-hidden",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
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
      className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[9999]"
      style={{ border: "none" }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={[
            "glass-container w-full shadow-2xl",
            sizeMap[size],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
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
