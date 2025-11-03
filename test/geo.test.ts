import { describe, expect, it } from 'vitest';
import { estimateWalkMinutes, haversineDistanceMeters } from '../src/geo.js';

describe('haversineDistanceMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineDistanceMeters(59.3293, 18.0686, 59.3293, 18.0686)).toBe(0);
  });

  it('computes distance between Stockholm landmarks', () => {
    const distance = haversineDistanceMeters(59.3293, 18.0686, 59.3326, 18.0649);
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(600);
  });
});

describe('estimateWalkMinutes', () => {
  it('rounds up fractional minutes', () => {
    expect(estimateWalkMinutes(81)).toBe(2);
  });

  it('handles zero distance', () => {
    expect(estimateWalkMinutes(0)).toBe(0);
  });
});
