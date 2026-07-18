export type RandomSource = () => number

export function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], random: RandomSource): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
  }
  return copy
}

export function createSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0
}
