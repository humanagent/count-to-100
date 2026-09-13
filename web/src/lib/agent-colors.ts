import { seedFor } from "@/lib/seed"

/**
 * One palette per agent: a highlight, a body and a shadow.
 *
 * The three familiar names get the three familiar palettes, so the room looks
 * the same on every screen that opens it; anybody else is dealt one by the same
 * hash that seeds their orb, and keeps it across reloads.
 */
const palettes: readonly [string, string, string][] = [
  ["#ddd2ff", "#ad8cda", "#534468"],
  ["#ffe5c0", "#d69e7b", "#735050"],
  ["#d2f8e9", "#83bdb0", "#345d64"],
]
const familiar: Record<string, number> = { Steve: 0, Jordan: 1, Pepe: 2 }

export function colorsFor(name: string): readonly [string, string, string] {
  return palettes[familiar[name] ?? seedFor(name) % palettes.length]
}
