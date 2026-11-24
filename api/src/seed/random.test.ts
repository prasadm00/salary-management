import { describe, expect, it } from 'vitest';
import { createRandom, pickOne, pickWeighted, randomInt } from './random.js';

const drawMany = (random: () => number, times: number) =>
  Array.from({ length: times }, () => random());

describe('createRandom', () => {
  it('gives the same numbers for the same seed', () => {
    expect(drawMany(createRandom(7), 20)).toEqual(drawMany(createRandom(7), 20));
  });

  it('gives different numbers for a different seed', () => {
    expect(drawMany(createRandom(7), 20)).not.toEqual(drawMany(createRandom(8), 20));
  });

  it('only gives numbers from 0 up to (not including) 1', () => {
    for (const value of drawMany(createRandom(1), 5000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('stays inside the range and reaches both ends', () => {
    const random = createRandom(3);
    const values = Array.from({ length: 2000 }, () => randomInt(random, 5, 8));

    expect(Math.min(...values)).toBe(5);
    expect(Math.max(...values)).toBe(8);
  });

  it('returns whole numbers', () => {
    const random = createRandom(3);

    for (let i = 0; i < 200; i += 1) expect(Number.isInteger(randomInt(random, 1, 100))).toBe(true);
  });
});

describe('pickOne', () => {
  it('picks an item from the list', () => {
    const random = createRandom(5);

    for (let i = 0; i < 50; i += 1)
      expect(['a', 'b', 'c']).toContain(pickOne(random, ['a', 'b', 'c']));
  });
});

describe('pickWeighted', () => {
  it('picks items in proportion to their weights', () => {
    const random = createRandom(11);
    const items = [
      { value: 'common', weight: 75 },
      { value: 'rare', weight: 25 },
    ];

    const picks = Array.from({ length: 10000 }, () => pickWeighted(random, items));
    const commonShare = picks.filter((pick) => pick === 'common').length / picks.length;

    expect(commonShare).toBeGreaterThan(0.73);
    expect(commonShare).toBeLessThan(0.77);
  });

  it('never picks an item with weight 0', () => {
    const random = createRandom(2);
    const items = [
      { value: 'yes', weight: 1 },
      { value: 'never', weight: 0 },
    ];

    for (let i = 0; i < 500; i += 1) expect(pickWeighted(random, items)).toBe('yes');
  });
});
