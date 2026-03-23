"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
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
        className="fixed inset-0 p-0 bg-transparent backdrop:bg-black/60 backdrop:backdrop-blur-md w-full max-w-none m-0 h-full"
        style={{ border: "none" }}
      >
        <div className="flex h-full items-center justify-center sm:p-4">
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
          >
            <div
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0 border-b"
              style={{ borderColor: "var(--color-glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-semibold leading-tight"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-primary)" }}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 rounded-md transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2"
                style={{ color: "var(--color-text-secondary)", outlineColor: "var(--color-accent)" }}
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
      className="fixed inset-0 p-0 bg-transparent backdrop:bg-black/50 backdrop:backdrop-blur-md w-full max-w-none m-0 h-full"
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
                    className="text-lg font-semibold leading-tight"
                    style={{ fontFamily: "var(--font-heading)", color: "var(--color-text-primary)" }}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-1 rounded-md transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2"
                style={{ color: "var(--color-text-secondary)", outlineColor: "var(--color-accent)" }}
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
