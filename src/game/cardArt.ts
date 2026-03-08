export interface CardArtSources {
  png: string
  webp: string
}

export function slugifyCardName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function getCardArtSources(name: string): CardArtSources | null {
  const slug = slugifyCardName(name)
  if (!slug) return null

  return {
    png: `/cards/${slug}.png`,
    webp: `/cards/${slug}.webp`,
  }
}
