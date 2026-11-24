// Random helpers for the seed script.
// We do not use Math.random, because it gives different numbers every run.
// These give the same numbers every run for the same seed, so the data never changes.

/** A small random number generator (mulberry32). Returns numbers from 0 up to (not including) 1. */
export function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from min to max, including both. */
export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** One item from a list. */
export function pickOne<T>(random: () => number, items: readonly T[]): T {
  return items[randomInt(random, 0, items.length - 1)] as T;
}

/** One item from a list, where items with a bigger weight are picked more often. */
export function pickWeighted<T>(
  random: () => number,
  items: readonly { value: T; weight: number }[],
): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let point = random() * totalWeight;

  for (const item of items) {
    point -= item.weight;
    if (point < 0) return item.value;
  }
  // Only reached by rounding: fall back to the last item.
  return (items[items.length - 1] as { value: T }).value;
}
