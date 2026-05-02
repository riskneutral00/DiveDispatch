import type { CSSProperties, ReactNode } from "react";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { ERROR_REQUIRED } from "@/lib/validation/error-codes";
import { cn } from "@/lib/utils/cn";

interface FieldLabelProps {
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function FieldLabel({
  htmlFor,
  children,
  required,
  className,
  style,
}: FieldLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-[10px] font-medium text-secondary label-float-in",
        className,
      )}
      style={style}
    >
      {children}
      {required && <RequiredAsterisk />}
    </label>
  );
}

interface FieldErrorProps {
  id: string;
  message?: string;
}

export function FieldError({ id, message }: FieldErrorProps) {
  return <FieldMessage id={id} error={message} />;
}

interface FieldMessageProps {
  id: string;
  error?: string;
  helperText?: string;
}

export function FieldMessage({ id, error, helperText }: FieldMessageProps) {
  const isRequiredEmpty = error === ERROR_REQUIRED;
  const message = isRequiredEmpty ? "" : (error ?? helperText ?? "");
  const tone = error ? "text-destructive" : "text-secondary";
  return (
    <p
      id={id}
      role={error && !isRequiredEmpty ? "alert" : undefined}
      aria-hidden={!message || undefined}
      className={cn(
        "h-4 text-body truncate transition-opacity",
        tone,
        message ? "opacity-100" : "opacity-0",
      )}
    >
      {message || " "}
    </p>
  );
}

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
}

export function FieldShell({
  id,
  label,
  required,
  error,
  helperText,
  children,
  className,
}: FieldShellProps) {
  const errorId = `${id}-error`;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 w-full glass-container rounded-theme p-2 ",
        className,
      )}
    >
      {label && (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      )}
      {children}
      <FieldMessage id={errorId} error={error} helperText={helperText} />
    </div>
  );
}
