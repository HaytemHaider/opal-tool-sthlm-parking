# Stockholm Parking Opal Tool

Production-ready Opal Tool written in TypeScript that recommends nearby Stockholm Parkering facilities. The service exposes an HTTP API and integrates with the `@optimizely-opal/opal-tool-ocp-sdk` interface.

## Features

- `recommendFacility` tool method with strict JSON Schema validation
- Live facility metadata and availability fetching with retries, timeouts, and caching (SWR for availability)
- Distance and walking time calculations using the Haversine formula
- Structured JSON logging and graceful error handling
- Unit tests via Vitest
- Dockerized (multi-stage) build targeting Node.js 20

## Requirements

- Node.js 20+
- npm 9+

## Installation

```bash
npm install
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `SP_BASE_URL` | `https://api.stockholmparkering.se` | Base URL for Stockholm Parkering APIs |
| `SP_FACILITIES_PATH` | `/facilities` | Path for facility metadata endpoint (JSON array) |
| `SP_AVAILABILITY_PATH` | `/availability` | Path for live availability endpoint (JSON array) |
| `REQUEST_TIMEOUT_MS` | `3000` | Per-upstream request timeout (ms) |

> **Note:** Replace the placeholder API paths with the real Stockholm Parkering endpoints when wiring up to production services.

## Running locally (development)

```bash
npm run dev
```

The service listens on `http://localhost:3000`. Available endpoints:

- `GET /healthz` → `{"status":"ok"}`
- `POST /recommendFacility` → Calls the Opal tool method. Provide JSON matching the input schema.

Example request:

```bash
curl -X POST http://localhost:3000/recommendFacility \
  -H 'Content-Type: application/json' \
  -d '{
    "userLat": 59.3293,
    "userLon": 18.0686,
    "radiusMeters": 1000,
    "maxResults": 3
  }'
```

## Building and running (production)

```bash
npm run build
npm start
```

## Testing & linting

```bash
npm run lint
npm test
```

## Docker usage

Build the container:

```bash
docker build -t stockholm-parking-tool .
```

Run the container:

```bash
docker run -p 3000:3000 \
  -e SP_BASE_URL="https://api.stockholmparkering.se" \
  -e SP_FACILITIES_PATH="/facilities" \
  -e SP_AVAILABILITY_PATH="/availability" \
  stockholm-parking-tool
```

## Opal registration

When registering the tool with Optimizely Opal:

- Tool name: `stockholmParking`
- Method: `recommendFacility`
- Input & output schemas: see `src/tool.ts`
- Endpoint: `POST /recommendFacility`

Ensure the hosting environment exposes the HTTP endpoint and required environment variables.

## Project structure

```
.
├─ src/
│  ├─ index.ts        # HTTP server bootstrap
│  ├─ tool.ts         # Opal tool implementation
│  ├─ data.ts         # API fetchers, caching, retries
│  ├─ geo.ts          # Haversine distance helpers
│  ├─ log.ts          # Structured logger
│  ├─ types.ts        # Shared TypeScript types
│  └─ config.ts       # Environment parsing
├─ test/
│  ├─ geo.test.ts     # Distance helper tests
│  └─ rank.test.ts    # Ranking behavior tests
├─ Dockerfile
├─ .dockerignore
├─ package.json
├─ tsconfig.json
└─ .eslintrc.cjs
```
