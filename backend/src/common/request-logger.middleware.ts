import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** Registra cada requisição ao terminar: método, caminho, status e duração (data e hora vêm do Logger). */
export function requestLogger(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const startedAt = Date.now();
  response.on('finish', () => {
    logger.log(
      `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms`,
    );
  });
  next();
}
