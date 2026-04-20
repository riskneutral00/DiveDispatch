export function kebabBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function appendCollisionHash(slug: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  return `${slug}-${suffix}`
}
