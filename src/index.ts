import http from 'node:http';
import { loadConfig } from './config.js';
import parkingTool from './tool.js';
import { logger } from './log.js';

const config = loadConfig();

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body).toString()
  });
  res.end(body);
}

function parseRequestBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const LIMIT = 1024 * 64; // 64KB

    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > LIMIT) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('error', (error) => reject(error));

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8') || '{}';
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url?.startsWith('/healthz')) {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method === 'POST' && req.url === '/recommendFacility') {
      const payload = await parseRequestBody(req);
      const result = await parkingTool.recommendFacility(payload);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid input') {
      sendJson(res, 400, { error: error.message, details: (error as Error & { details?: unknown }).details });
      return;
    }

    if (error instanceof Error && error.message === 'Payload too large') {
      sendJson(res, 413, { error: error.message });
      return;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      sendJson(res, 504, { error: 'Request timed out' });
      return;
    }

    logger.error('Unhandled server error', {
      error: error instanceof Error ? error.message : String(error)
    });
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(config.port, () => {
  logger.info('Server started', { port: config.port });
});

export default server;
