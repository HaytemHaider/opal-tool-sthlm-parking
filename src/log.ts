export type LogLevel = 'info' | 'error';

type LogPayload = Record<string, unknown>;

const baseFields = {
  service: 'stockholmParking'
} as const;

function log(level: LogLevel, message: string, payload?: LogPayload): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...baseFields,
    ...payload
  };
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}

export const logger = {
  info(message: string, payload?: LogPayload): void {
    log('info', message, payload);
  },
  error(message: string, payload?: LogPayload): void {
    log('error', message, payload);
  }
};

export type Logger = typeof logger;
