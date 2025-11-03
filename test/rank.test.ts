import { describe, expect, it } from 'vitest';
import { sortRecommendations } from '../src/tool.js';
import { FacilityRecommendation } from '../src/types.js';

function recommendation(partial: Partial<FacilityRecommendation> & Pick<FacilityRecommendation, 'id'>): FacilityRecommendation {
  return {
    name: 'Facility',
    lat: 0,
    lon: 0,
    freeSpaces: null,
    capacity: null,
    tariffNote: null,
    zoneCode: null,
    distanceMeters: 0,
    walkMinutes: 0,
    lastUpdated: null,
    stale: false,
    sourceUrl: 'https://example.com',
    ...partial
  };
}

describe('sortRecommendations', () => {
  it('sorts by distance ascending', () => {
    const items = sortRecommendations([
      recommendation({ id: 'b', distanceMeters: 200 }),
      recommendation({ id: 'a', distanceMeters: 100 }),
      recommendation({ id: 'c', distanceMeters: 300 })
    ]);

    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by free spaces descending when distance equal', () => {
    const items = sortRecommendations([
      recommendation({ id: 'a', distanceMeters: 100, freeSpaces: 2 }),
      recommendation({ id: 'b', distanceMeters: 100, freeSpaces: 5 }),
      recommendation({ id: 'c', distanceMeters: 100, freeSpaces: null })
    ]);

    expect(items.map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });
});
