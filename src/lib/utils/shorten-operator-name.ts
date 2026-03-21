const ACRONYMS: [string, string][] = [
  ['Dive Center', 'DC'],
  ['Dive Resort', 'DR'],
  ['Dive Hostel', 'DH'],
  ['Diving Center', 'DC'],
]

export function shortenOperatorName(name: string): string {
  for (const [phrase, acronym] of ACRONYMS) {
    if (name.includes(phrase)) {
      return name.replace(phrase, acronym).trimEnd()
    }
  }
  return name
}
