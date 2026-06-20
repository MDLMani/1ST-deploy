export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly meta?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    meta?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.meta = meta;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
