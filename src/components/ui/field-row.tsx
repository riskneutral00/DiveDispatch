import { useId, type ReactNode } from "react";
import { FieldMessage } from "@/components/ui/field-shell";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { cn } from "@/lib/utils/cn";

const LITERAL = {
  default: "grid grid-cols-6 gap-x-3 gap-y-0 sm:flex sm:flex-wrap sm:items-end sm:gap-x-4 sm:gap-y-0", // design-ok: 6-col mobile baseline with field-* width tokens; per-field h-4 message slot provides row separation when fields wrap, items-end keeps underlines aligned
  compact: "grid grid-cols-6 gap-x-3 gap-y-0 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-0", // design-ok: same 6-col baseline, compact desktop gap (sm:gap-x-3) for dense data
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
      <FieldMessage id={errorId} error={error} />
    </fieldset>
  );
}
