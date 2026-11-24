import { describe, expect, it } from 'vitest';
import { containsPattern } from './likePattern.js';

describe('containsPattern', () => {
  it('wraps plain text so it matches anywhere inside a value', () => {
    expect(containsPattern('priya')).toBe('%priya%');
  });

  it('turns the LIKE wildcard % into a literal percent sign', () => {
    expect(containsPattern('50%')).toBe('%50\\%%');
  });

  it('turns the LIKE wildcard _ into a literal underscore', () => {
    expect(containsPattern('sam_lee')).toBe('%sam\\_lee%');
  });

  it('escapes the escape character itself, so a backslash cannot undo the escaping', () => {
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
    expect(containsPattern('\\%')).toBe('%\\\\\\%%');
  });

  it('leaves quotes alone, because values are always sent as parameters, never joined into SQL', () => {
    expect(containsPattern("o'brien")).toBe("%o'brien%");
  });
});
