export function enumToDisplayLabel(value: string): string {
  if (!value) return ''
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}
