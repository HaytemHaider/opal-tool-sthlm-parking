import { Logger } from './log.js';
import {
  AvailabilityResult,
  FacilityAvailability,
  FacilityMetadata,
  ServiceConfig
} from './types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface AvailabilityCacheEntry extends CacheEntry<Map<string, FacilityAvailability>> {
  revalidatePromise?: Promise<Map<string, FacilityAvailability>>;
}

const facilityCache: { entry?: CacheEntry<FacilityMetadata[]> } = {};
const availabilityCache: { entry?: AvailabilityCacheEntry } = {};

const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildUrl(baseUrl: string, path: string): string {
  try {
    const url = new URL(path, baseUrl);
    return url.toString();
  } catch (error) {
    throw new Error(`Failed to construct URL from base '${baseUrl}' and path '${path}': ${String(error)}`);
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const str = String(value);
  return str.length > 0 ? str : null;
}

async function fetchWithRetries<T>(
  url: string,
  config: ServiceConfig,
  log: Logger,
  externalSignal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const timeoutSignal = AbortSignal.timeout(config.requestTimeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal
      });

      if (!response.ok) {
        if (RETRY_STATUS_CODES.has(response.status) && attempt < MAX_ATTEMPTS) {
          const delay = 200 * 2 ** (attempt - 1);
          log.info('Retrying upstream request', {
            attempt,
            status: response.status,
            url,
            delay
          });
          await sleep(delay);
          continue;
        }
        const body = await response.text();
        throw new Error(`Request failed with status ${response.status}: ${body}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (signal.aborted && externalSignal?.aborted) {
        throw externalSignal.reason instanceof Error
          ? externalSignal.reason
          : new Error(String(externalSignal.reason ?? 'Aborted'));
      }
      lastError = error;
      if (attempt >= MAX_ATTEMPTS) {
        break;
      }
      const delay = 200 * 2 ** (attempt - 1);
      log.info('Retrying upstream request after error', {
        attempt,
        url,
        delay,
        error: error instanceof Error ? error.message : String(error)
      });
      await sleep(delay);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to fetch URL ${url}: ${String(lastError)}`);
}

function normalizeFacilityMetadata(
  raw: Record<string, unknown>,
  config: ServiceConfig
): FacilityMetadata | null {
  const idValue = raw.id ?? raw.Id ?? raw.facilityId ?? raw.FacilityId;
  const nameValue = raw.name ?? raw.Name ?? raw.siteName ?? raw.SiteName;

  const positionValue = raw.position ?? raw.Position;
  const positionRecord =
    typeof positionValue === 'object' && positionValue !== null
      ? (positionValue as Record<string, unknown>)
      : undefined;

  let latValue = raw.lat ?? raw.latitude ?? raw.Latitude;
  if (latValue === undefined && positionRecord) {
    latValue = positionRecord.lat ?? positionRecord.Lat ?? positionRecord.latitude ?? positionRecord.Latitude;
  }

  let lonValue = raw.lon ?? raw.longitude ?? raw.Longitude;
  if (lonValue === undefined && positionRecord) {
    lonValue = positionRecord.lon ?? positionRecord.Lon ?? positionRecord.longitude ?? positionRecord.Longitude;
  }

  if (!idValue || !nameValue || latValue === undefined || lonValue === undefined) {
    return null;
  }

  const lat = Number(latValue);
  const lon = Number(lonValue);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const capacity = toNumberOrNull(raw.capacity ?? raw.Capacity);
  const tariffNote = toStringOrNull(raw.tariffNote ?? raw.TariffNote);
  const zoneCode = toStringOrNull(raw.zoneCode ?? raw.ZoneCode);
  const sourceUrl =
    toStringOrNull(
      raw.sourceUrl ?? raw.SourceUrl ?? raw.url ?? raw.Url ?? `${config.baseUrl}${config.facilitiesPath}`
    ) ?? `${config.baseUrl}${config.facilitiesPath}`;

  return {
    id: String(idValue),
    name: String(nameValue),
    lat,
    lon,
    capacity,
    tariffNote,
    zoneCode,
    sourceUrl
  };
}

function normalizeAvailability(raw: Record<string, unknown>): FacilityAvailability | null {
  const idValue = raw.id ?? raw.Id ?? raw.facilityId ?? raw.FacilityId;
  if (!idValue) {
    return null;
  }

  const freeSpaces = toNumberOrNull(raw.freeSpaces ?? raw.FreeSpaces ?? raw.vacant ?? raw.Vacant);
  const capacity = toNumberOrNull(raw.capacity ?? raw.Capacity);
  const lastUpdated = toStringOrNull(
    raw.lastUpdated ?? raw.LastUpdated ?? raw.updatedAt ?? raw.UpdatedAt ?? raw.timestamp ?? raw.Timestamp
  );

  return {
    id: String(idValue),
    freeSpaces,
    capacity,
    lastUpdated
  };
}

export async function getFacilities(
  config: ServiceConfig,
  log: Logger,
  signal?: AbortSignal
): Promise<FacilityMetadata[]> {
  const now = Date.now();
  const cached = facilityCache.entry;
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const url = buildUrl(config.baseUrl, config.facilitiesPath);
  const rawData = await fetchWithRetries<unknown>(url, config, log, signal);

  if (!Array.isArray(rawData)) {
    throw new Error('Facilities response is not an array');
  }

  const facilities = rawData
    .map((item) => (typeof item === 'object' && item !== null ? item : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => normalizeFacilityMetadata(item, config))
    .filter((item): item is FacilityMetadata => item !== null);

  facilityCache.entry = {
    value: facilities,
    expiresAt: now + config.facilitiesTtlMs
  };

  log.info('Loaded facilities metadata', { count: facilities.length });

  return facilities;
}

async function refreshAvailability(
  config: ServiceConfig,
  log: Logger,
  signal?: AbortSignal
): Promise<Map<string, FacilityAvailability>> {
  const url = buildUrl(config.baseUrl, config.availabilityPath);
  const rawData = await fetchWithRetries<unknown>(url, config, log, signal);

  if (!Array.isArray(rawData)) {
    throw new Error('Availability response is not an array');
  }

  const availability = new Map<string, FacilityAvailability>();
  for (const item of rawData) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const normalized = normalizeAvailability(item as Record<string, unknown>);
    if (normalized) {
      availability.set(normalized.id, normalized);
    }
  }

  return availability;
}

export async function getAvailability(
  config: ServiceConfig,
  log: Logger,
  signal?: AbortSignal
): Promise<AvailabilityResult> {
  const now = Date.now();
  const cached = availabilityCache.entry;

  if (cached && cached.expiresAt > now) {
    return { data: cached.value, stale: false };
  }

  if (cached && cached.revalidatePromise) {
    return { data: cached.value, stale: true };
  }

  if (cached && cached.expiresAt <= now) {
    const revalidatePromise = refreshAvailability(config, log, signal)
      .then((data) => {
        availabilityCache.entry = {
          value: data,
          expiresAt: Date.now() + config.availabilityTtlMs
        };
        return data;
      })
      .catch((error) => {
        log.error('Failed to refresh availability', {
          error: error instanceof Error ? error.message : String(error)
        });
        if (availabilityCache.entry) {
          availabilityCache.entry.revalidatePromise = undefined;
        }
        return cached.value;
      });

    availabilityCache.entry = {
      value: cached.value,
      expiresAt: cached.expiresAt,
      revalidatePromise
    };

    return { data: cached.value, stale: true };
  }

  try {
    const fresh = await refreshAvailability(config, log, signal);
    availabilityCache.entry = {
      value: fresh,
      expiresAt: now + config.availabilityTtlMs
    };
    return { data: fresh, stale: false };
  } catch (error) {
    if (cached) {
      log.error('Falling back to stale availability cache', {
        error: error instanceof Error ? error.message : String(error)
      });
      return { data: cached.value, stale: true };
    }
    throw error;
  }
}
