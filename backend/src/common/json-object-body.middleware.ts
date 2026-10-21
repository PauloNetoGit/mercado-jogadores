import { BadRequestException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

/**
 * V1: o corpo é um objeto JSON. Array e valor simples são recusados com 400.
 * Pedidos sem corpo (consultas, exclusão, venda) ignoram o que for enviado.
 */
export function jsonObjectBody(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const body: unknown = request.body;
  const hasBody =
    body !== undefined &&
    !(
      typeof body === 'object' &&
      body !== null &&
      Object.keys(body).length === 0 &&
      !Array.isArray(body)
    );
  if (
    METHODS_WITH_BODY.has(request.method) &&
    hasBody &&
    (typeof body !== 'object' || body === null || Array.isArray(body))
  ) {
    next(
      new BadRequestException('O corpo da requisição deve ser um objeto JSON.'),
    );
    return;
  }
  next();
}
