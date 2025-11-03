export interface ErrorOptions {
  cause?: unknown;
}

export class UpstreamServiceError extends Error {
  readonly service: string;
  readonly cause?: unknown;

  constructor(service: string, message: string, options: ErrorOptions = {}) {
    super(message);
    this.name = 'UpstreamServiceError';
    this.service = service;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
