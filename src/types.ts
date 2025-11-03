export interface RecommendFacilityArgs {
  userLat: number;
  userLon: number;
  destinationLat?: number;
  destinationLon?: number;
  radiusMeters?: number;
  maxResults?: number;
}

export interface FacilityMetadata {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
  tariffNote: string | null;
  zoneCode: string | null;
  sourceUrl: string;
}

export interface FacilityAvailability {
  id: string;
  freeSpaces: number | null;
  capacity: number | null;
  lastUpdated: string | null;
}

export interface FacilityRecommendation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  freeSpaces: number | null;
  capacity: number | null;
  tariffNote: string | null;
  zoneCode: string | null;
  distanceMeters: number;
  walkMinutes: number;
  lastUpdated: string | null;
  stale: boolean;
  sourceUrl: string;
}

export interface AvailabilityResult {
  data: Map<string, FacilityAvailability>;
  stale: boolean;
}

export interface ServiceConfig {
  port: number;
  baseUrl: string;
  facilitiesPath: string;
  availabilityPath: string;
  requestTimeoutMs: number;
  availabilityTtlMs: number;
  facilitiesTtlMs: number;
  overallTimeoutMs: number;
}
