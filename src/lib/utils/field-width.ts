const OVERRIDE_PATTERN = /\b(field-(xs|sm|md|lg|xl)|w-|col-span|flex-1)\b/

export function resolveFieldWidth(
  defaultClass: string,
  className: string | undefined,
): string {
  if (!className) return defaultClass
  if (OVERRIDE_PATTERN.test(className)) return className
  return `${defaultClass} ${className}`
}
