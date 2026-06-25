/**
 * Deterministic random number generation.
 *
 * Uses a 32-bit xorshift32 PRNG so that mock data is fully reproducible
 * given the same seed.  Real cryptographic randomness is not required —
 * we only need stable, fast RNG for tests and demo data.
 *
 * The exported helpers (`createRng`, `randomBetween`, `randomBigInt`) form
 * a tiny toolkit that the other mock generators build on top of.
 */

export type Rng = () => number;

/**
 * Build a deterministic RNG from a numeric seed.
 *
 * Implementation: xorshift32 (Vigna's algorithm).  A 32-bit state is
 * maintained in a closure and advanced on every call.  Period is 2^32 - 1.
 *
 * The returned function returns a float in [0, 1) so that callers can
 * scale to whatever range they need without re-implementing the
 * conversion.
 */
export function createRng(seed: number): Rng {
  // Avoid the 0 state (xorshift32 would lock up).  Mix the seed so even
  // seed=0 produces a non-zero starting state.
  let state = (seed | 0) ^ 0x9e3779b9;
  if (state === 0) state = 0x9e3779b9;

  return function next(): number {
    let x = state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    state = x | 0;
    // Convert to [0, 1).  Use unsigned right shift to keep the value
    // non-negative even if `state` becomes negative due to the |0 above.
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

/**
 * Return a random integer in [min, max] inclusive, using the supplied rng.
 *
 * If `min === max`, the value is returned unchanged.  If `min > max`,
 * the arguments are swapped so the function never throws on user error.
 */
export function randomBetween(rng: Rng, min: number, max: number): number {
  if (min === max) return min;
  if (min > max) [min, max] = [max, min];
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

/**
 * Return a random bigint in [min, max] inclusive, using the supplied rng.
 *
 * Useful for raw token amounts (e.g. wei / satoshi) that don't fit in a
 * JS number.  The implementation calls `randomBetween` 4 times and
 * concatenates the results into a 64-bit-ish bigint, then clamps to the
 * range so the output is always in [min, max].
 */
export function randomBigInt(rng: Rng, min: bigint, max: bigint): bigint {
  if (min === max) return min;
  if (min > max) [min, max] = [max, min];

  // 4 * 24 = 96 bits of entropy, plenty for amounts in the e24 range.
  const part0 = BigInt(randomBetween(rng, 0, 0xffffff));
  const part1 = BigInt(randomBetween(rng, 0, 0xffffff));
  const part2 = BigInt(randomBetween(rng, 0, 0xffffff));
  const part3 = BigInt(randomBetween(rng, 0, 0xffffff));
  const raw = (part0 << 72n) | (part1 << 48n) | (part2 << 24n) | part3;

  const span = max - min + 1n;
  return min + (raw % span);
}
