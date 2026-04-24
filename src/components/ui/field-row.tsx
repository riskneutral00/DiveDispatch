import { useId, type ReactNode } from "react";
import { RequiredAsterisk } from "@/components/ui/required-asterisk";
import { cn } from "@/lib/utils/cn";

const INNER_LITERAL = "grid grid-cols-6 gap-x-3 gap-y-4 sm:flex sm:flex-wrap sm:items-end sm:gap-4"; // design-ok: 6-col mobile baseline with field-* width tokens, flex-wrap on sm+

interface FieldRowProps {
  children: ReactNode;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
}

export function FieldRow({
  children,
  label,
  required,
  error,
  className,
}: FieldRowProps) {
  const errorId = useId();

  if (label === undefined) {
    return <div className={cn(INNER_LITERAL, className)}>{children}</div>;
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
      <div className={INNER_LITERAL}>{children}</div>
      {error ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
