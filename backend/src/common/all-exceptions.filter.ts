import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Toda recusa devolve JSON com `message` em texto e sem stack trace. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response
        .status(status)
        .json({ statusCode: status, message: this.messageOf(exception) });
      return;
    }

    const status = this.statusOfBodyParserError(exception);
    if (status !== null) {
      response.status(status).json({
        statusCode: status,
        message: 'O corpo da requisição não é um JSON válido.',
      });
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
    });
  }

  private messageOf(exception: HttpException): string {
    const body = exception.getResponse();
    const raw =
      typeof body === 'string' ? body : (body as { message?: unknown }).message;
    if (Array.isArray(raw)) return raw.join('; ');
    return typeof raw === 'string' && raw.length > 0 ? raw : exception.message;
  }

  private statusOfBodyParserError(exception: unknown): number | null {
    const status = (exception as { status?: unknown } | null)?.status;
    return typeof status === 'number' && status >= 400 && status < 500
      ? status
      : null;
  }
}
