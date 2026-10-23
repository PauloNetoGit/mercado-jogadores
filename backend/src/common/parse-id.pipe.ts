import {
  createParamDecorator,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';

export const MAX_ID = 2_147_483_647;

/** V8: id da URL que não é inteiro positivo só com dígitos, sem zero à esquerda, ou passa de 2.147.483.647, é inexistente (404). */
export function parsePathId(raw: string, message: string): number {
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_ID) {
    throw new NotFoundException(message);
  }
  return Number(raw);
}

/**
 * Lê o id direto da URL, antes de qualquer conversão do ValidationPipe global
 * (que transformaria "01" em 1 e esconderia o zero à esquerda da V8).
 */
const pathId = (message: string) =>
  createParamDecorator((_data: unknown, context: ExecutionContext): number => {
    const request = context
      .switchToHttp()
      .getRequest<{ params: Record<string, string> }>();
    return parsePathId(request.params.id, message);
  })();

export const PlayerId = () => pathId('Jogador não encontrado.');
export const ClubId = () => pathId('Clube não encontrado.');
export const MatchId = () => pathId('Partida não encontrada.');
