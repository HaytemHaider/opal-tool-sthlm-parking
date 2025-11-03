import { ServiceConfig } from './types.js';

const DEFAULT_PORT = 3000;
const DEFAULT_BASE_URL = 'https://api.stockholmparkering.se';
const DEFAULT_FACILITIES_PATH = '/facilities';
const DEFAULT_AVAILABILITY_PATH = '/availability';
const DEFAULT_REQUEST_TIMEOUT = 3000;
const DEFAULT_AVAILABILITY_TTL = 60 * 1000;
const DEFAULT_FACILITIES_TTL = 24 * 60 * 60 * 1000;
const DEFAULT_OVERALL_TIMEOUT = 8000;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): ServiceConfig {
  const port = parseInteger(process.env.PORT, DEFAULT_PORT);
  const requestTimeoutMs = parseInteger(process.env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT);
  const overallTimeoutMs = DEFAULT_OVERALL_TIMEOUT;

  const baseUrl = process.env.SP_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const facilitiesPath = process.env.SP_FACILITIES_PATH?.trim() || DEFAULT_FACILITIES_PATH;
  const availabilityPath = process.env.SP_AVAILABILITY_PATH?.trim() || DEFAULT_AVAILABILITY_PATH;

  return {
    port,
    baseUrl,
    facilitiesPath,
    availabilityPath,
    requestTimeoutMs,
    availabilityTtlMs: DEFAULT_AVAILABILITY_TTL,
    facilitiesTtlMs: DEFAULT_FACILITIES_TTL,
    overallTimeoutMs
  };
}
