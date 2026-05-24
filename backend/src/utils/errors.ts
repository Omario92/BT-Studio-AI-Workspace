import { FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  NotFound: (msg = 'Not found') => new AppError(404, msg, 'NOT_FOUND'),
  Unauthorized: (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED'),
  Forbidden: (msg = 'Forbidden') => new AppError(403, msg, 'FORBIDDEN'),
  BadRequest: (msg = 'Bad request') => new AppError(400, msg, 'BAD_REQUEST'),
  Conflict: (msg = 'Conflict') => new AppError(409, msg, 'CONFLICT'),
  Internal: (msg = 'Internal server error') => new AppError(500, msg, 'INTERNAL_ERROR'),
};

export function errorHandler(
  error: Error,
  _req: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }
  // Fastify validation errors
  if ('validation' in error) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
  }
  console.error('[Unhandled Error]', error);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
  });
}
