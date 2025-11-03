import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';
import * as sdk from '@optimizely-opal/opal-tool-ocp-sdk';
import { getAvailability, getFacilities } from './data.js';
import { estimateWalkMinutes, haversineDistanceMeters } from './geo.js';
import { loadConfig } from './config.js';
import { logger, Logger } from './log.js';
import { ServiceConfig, RecommendFacilityArgs, FacilityRecommendation } from './types.js';

const DEFAULT_RADIUS = 1500;
const DEFAULT_MAX_RESULTS = 5;

const { OpalTool: OpalToolBase } = sdk as { OpalTool?: new (definition: unknown) => unknown };

class FallbackTool {
  definition: unknown;
  constructor(definition: unknown) {
    this.definition = definition;
  }
}

const BaseTool = OpalToolBase ?? FallbackTool;

const inputSchema: JSONSchemaType<RecommendFacilityArgs> = {
  type: 'object',
  required: ['userLat', 'userLon'],
  additionalProperties: false,
  properties: {
    userLat: { type: 'number', minimum: -90, maximum: 90 },
    userLon: { type: 'number', minimum: -180, maximum: 180 },
    destinationLat: { type: 'number', minimum: -90, maximum: 90, optional: true },
    destinationLon: { type: 'number', minimum: -180, maximum: 180, optional: true },
    radiusMeters: {
      type: 'integer',
      minimum: 100,
      maximum: 5000,
      default: DEFAULT_RADIUS,
      optional: true
    },
    maxResults: {
      type: 'integer',
      minimum: 1,
      maximum: 10,
      default: DEFAULT_MAX_RESULTS,
      optional: true
    }
  }
};

const outputSchema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['id', 'name', 'lat', 'lon', 'distanceMeters', 'walkMinutes', 'sourceUrl'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      lat: { type: 'number' },
      lon: { type: 'number' },
      freeSpaces: { type: ['integer', 'null'] },
      capacity: { type: ['integer', 'null'] },
      tariffNote: { type: ['string', 'null'] },
      zoneCode: { type: ['string', 'null'] },
      distanceMeters: { type: 'integer' },
      walkMinutes: { type: 'integer' },
      lastUpdated: { type: ['string', 'null'] },
      stale: { type: 'boolean', default: false },
      sourceUrl: { type: 'string', format: 'uri' }
    }
  }
};

const ajv = new Ajv({ useDefaults: true, allErrors: true, strict: true });
addFormats(ajv);

const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

function normalizeArgs(args: RecommendFacilityArgs): Required<RecommendFacilityArgs> {
  return {
    userLat: args.userLat,
    userLon: args.userLon,
    destinationLat: args.destinationLat ?? args.userLat,
    destinationLon: args.destinationLon ?? args.userLon,
    radiusMeters: args.radiusMeters ?? DEFAULT_RADIUS,
    maxResults: args.maxResults ?? DEFAULT_MAX_RESULTS
  };
}

export function sortRecommendations(results: FacilityRecommendation[]): FacilityRecommendation[] {
  return [...results].sort((a, b) => {
    if (a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    const freeA = a.freeSpaces ?? -1;
    const freeB = b.freeSpaces ?? -1;
    return freeB - freeA;
  });
}

function enforceMaxResults(results: FacilityRecommendation[], limit: number): FacilityRecommendation[] {
  if (results.length <= limit) {
    return results;
  }
  return results.slice(0, limit);
}

export class StockholmParkingTool extends BaseTool {
  private readonly log: Logger;
  private readonly config: ServiceConfig;

  constructor(config: ServiceConfig, log: Logger = logger) {
    super({
      name: 'stockholmParking',
      description: 'Recommends nearby Stockholm Parkering facilities.',
      methods: [
        {
          name: 'recommendFacility',
          description: 'Recommend nearby parking facilities based on user or destination coordinates.',
          inputSchema,
          outputSchema
        }
      ]
    });

    this.log = log;
    this.config = config;
  }

  /**
   * Recommend nearby parking facilities combining metadata and live availability.
   * @param rawArgs Raw input arguments.
   * @returns List of facility recommendations.
   */
  async recommendFacility(rawArgs: unknown): Promise<FacilityRecommendation[]> {
    if (!validateInput(rawArgs)) {
      const error = new Error('Invalid input');
      (error as Error & { details?: unknown }).details = validateInput.errors;
      this.log.error('Input validation failed', { errors: validateInput.errors });
      throw error;
    }

    const args = normalizeArgs(rawArgs as RecommendFacilityArgs);

    const overallController = new AbortController();
    const timeout = setTimeout(() => {
      overallController.abort(new Error('Operation timed out'));
    }, this.config.overallTimeoutMs);

    try {
      const [facilities, availabilityResult] = await Promise.all([
        getFacilities(this.config, this.log, overallController.signal),
        getAvailability(this.config, this.log, overallController.signal)
      ]);

      const targetLat = args.destinationLat ?? args.userLat;
      const targetLon = args.destinationLon ?? args.userLon;

      const enriched = facilities
        .map((facility) => {
          const availability = availabilityResult.data.get(facility.id);
          const capacity = availability?.capacity ?? facility.capacity ?? null;
          const freeSpaces = availability?.freeSpaces ?? null;
          const lastUpdated = availability?.lastUpdated ?? null;
          const distanceMeters = haversineDistanceMeters(targetLat, targetLon, facility.lat, facility.lon);
          const walkMinutes = estimateWalkMinutes(distanceMeters);

          return {
            id: facility.id,
            name: facility.name,
            lat: facility.lat,
            lon: facility.lon,
            freeSpaces,
            capacity,
            tariffNote: facility.tariffNote,
            zoneCode: facility.zoneCode,
            distanceMeters,
            walkMinutes,
            lastUpdated,
            stale: availabilityResult.stale,
            sourceUrl: facility.sourceUrl
          } satisfies FacilityRecommendation;
        })
        .filter((facility) => facility.distanceMeters <= args.radiusMeters);

      const sorted = sortRecommendations(enriched);

      const limited = enforceMaxResults(sorted, args.maxResults);

      if (!validateOutput(limited)) {
        this.log.error('Output validation failed', { errors: validateOutput.errors });
        throw new Error('Internal output validation failed');
      }

      this.log.info('Generated facility recommendations', {
        count: limited.length,
        staleAvailability: availabilityResult.stale
      });

      return limited;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export default new StockholmParkingTool(loadConfig());
