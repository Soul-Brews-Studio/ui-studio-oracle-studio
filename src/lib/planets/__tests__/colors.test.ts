import { describe, it, expect } from 'bun:test';
import {
  clusterColorFromTypes,
  planetColor,
  ageInDays,
  TYPE_COLORS,
} from '../colors';

describe('clusterColorFromTypes', () => {
  it('returns fallback grey for empty counts', () => {
    expect(clusterColorFromTypes({})).toBe('#888888');
  });

  it('returns the palette color for a single type', () => {
    expect(clusterColorFromTypes({ principle: 10 })).toBe(TYPE_COLORS.principle);
    expect(clusterColorFromTypes({ learning: 3 })).toBe(TYPE_COLORS.learning);
  });

  it('mixes toward the heavier type', () => {
    const mixed = clusterColorFromTypes({ principle: 10, retro: 1 });
    expect(mixed).not.toBe(TYPE_COLORS.principle);
    expect(mixed).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('ignores zero/negative counts', () => {
    expect(clusterColorFromTypes({ principle: 0, learning: 0 })).toBe('#888888');
  });
});

describe('planetColor', () => {
  it('brightens recent (<7d) planets', () => {
    const bright = planetColor('principle', 2);
    expect(bright).not.toBe(TYPE_COLORS.principle);
    expect(bright).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps normal-age planets unchanged', () => {
    expect(planetColor('learning', 20)).toBe(TYPE_COLORS.learning);
  });

  it('darkens old (>30d) planets', () => {
    const faded = planetColor('retro', 90);
    expect(faded).not.toBe(TYPE_COLORS.retro);
  });

  it('uses fallback for unknown type', () => {
    expect(planetColor('mystery', 10)).toBe('#888888');
  });
});

describe('ageInDays', () => {
  it('returns Infinity for null', () => {
    expect(ageInDays(null)).toBe(Infinity);
  });

  it('computes days since createdAt', () => {
    const now = 1_700_000_000_000;
    const oneDayAgo = now - 86_400_000;
    expect(ageInDays(oneDayAgo, now)).toBeCloseTo(1, 5);
  });

  it('never returns negative age', () => {
    const now = 1_700_000_000_000;
    expect(ageInDays(now + 10_000, now)).toBe(0);
  });
});
