const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 * @param lat1 Latitude of the first point in decimal degrees.
 * @param lon1 Longitude of the first point in decimal degrees.
 * @param lat2 Latitude of the second point in decimal degrees.
 * @param lon2 Longitude of the second point in decimal degrees.
 * @returns Distance in meters between the points.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Estimates walking time in minutes using a conservative walking speed of 80 meters per minute.
 * @param distanceMeters Distance in meters.
 * @returns Walking time in minutes, rounded up.
 */
export function estimateWalkMinutes(distanceMeters: number): number {
  const WALKING_SPEED_METERS_PER_MINUTE = 80;
  return Math.max(0, Math.ceil(distanceMeters / WALKING_SPEED_METERS_PER_MINUTE));
}
