import { useId, type ReactNode } from "react";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { cn } from "@/lib/utils/cn";

const LITERAL = {
  default: "grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4", // design-ok: 6-col mobile baseline with field-* width tokens, flex-wrap items-end on sm+
  compact: "grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-3", // design-ok: same 6-col baseline, compact desktop gap (sm:gap-3) for dense data
} as const;

interface FieldRowProps {
  children: ReactNode;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  innerClassName?: string;
  density?: "default" | "compact";
}

export function FieldRow({
  children,
  label,
  required,
  error,
  className,
  innerClassName,
  density = "default",
}: FieldRowProps) {
  const errorId = useId();
  const inner = LITERAL[density];

  if (label === undefined) {
    return <div className={cn(inner, className, innerClassName)}>{children}</div>;
  }

  return (
    <fieldset
      className={className}
      role="group"
      aria-describedby={error ? errorId : undefined}
    >
      <legend>
        {label}
        {required ? <RequiredAsterisk /> : null}
      </legend>
      <div className={cn(inner, innerClassName)}>{children}</div>
      {error ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
