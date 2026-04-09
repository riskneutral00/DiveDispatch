"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/icon-button";
import { INTERACTION_DEFAULTS } from "@/lib/constants/interaction-config";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  fullScreen?: boolean;
  melt?: boolean;
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
  melt = INTERACTION_DEFAULTS.dialogMelt,
  className = "",
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (melt) {
        document.querySelectorAll("dialog[open][data-melt]").forEach((d) => {
          if (d === dialog) return;
          const panel = d.querySelector<HTMLElement>(".dialog-fullscreen-panel, .glass-dialog");
          if (panel) {
            panel.style.transition = "opacity 0.25s ease";
            panel.style.opacity = "0";
            panel.dataset.melted = "";
          }
        });
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      if (dialog.open) dialog.close();
      document.querySelectorAll<HTMLElement>("[data-melted]").forEach((el) => {
        el.style.opacity = "";
        el.style.transition = "";
        delete el.dataset.melted;
      });
    };
  }, [open, melt]);

  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

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
        data-melt={melt || undefined}
        className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[var(--z-modal)]"
        style={{ border: "none" }}
      >
        <div
          className="flex h-full items-center justify-center sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
          <div /* design-ok */
            className={cn(
              "dialog-fullscreen-panel flex flex-col text-primary glass-dialog",
              "w-full h-full rounded-none", // design-ok
              "sm:w-[90vw] sm:h-[90vh] sm:max-w-[800px] sm:rounded-[var(--border-radius,12px)]",
              "overflow-hidden",
              className,
            )}
          >
            <div
              className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0 border-b"
              style={{ borderColor: "var(--color-glass-border)" }}
            >
              <div className="flex-1 min-w-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-card-title font-semibold leading-tight text-primary font-heading"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-body text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                onClick={onClose}
                variant="ghost"
                aria-label="Close dialog"
                className="flex-shrink-0"
              >
                <X size={20} />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
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
      data-melt={melt || undefined}
      className="fixed inset-0 p-0 bg-transparent w-full max-w-none m-0 h-full z-[var(--z-modal)]"
      style={{ border: "none" }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            "glass-dialog w-full shadow-2xl text-primary",
            sizeMap[size],
            className,
          )}
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
                    className="text-card-title font-semibold leading-tight text-primary font-heading"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descId} className="mt-1 text-body text-secondary">
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                onClick={onClose}
                variant="ghost"
                aria-label="Close dialog"
                className="flex-shrink-0"
              >
                <X size={18} />
              </IconButton>
            </div>
          )}

          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
