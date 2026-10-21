import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClubId, PlayerId } from '../common/parse-id.pipe';
import type { RawQuery } from '../common/query-params';
import { BuyPlayerDto } from './dto/buy-player.dto';
import { parseTransactionsFilter } from './dto/transactions-filter';
import { MarketService } from './market.service';

@ApiTags('Mercado')
@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @ApiOperation({
    summary: 'Compra jogador livre e cria o contrato (RN12 a RN14)',
  })
  @Post('players/:id/buy')
  @HttpCode(200)
  buy(@PlayerId() id: number, @Body() dto: BuyPlayerDto) {
    return this.marketService.buy(id, dto);
  }

  @ApiOperation({ summary: 'Vende o jogador pelo clube atual (RN15 e RN16)' })
  @Post('players/:id/sell')
  @HttpCode(200)
  sell(@PlayerId() id: number) {
    return this.marketService.sell(id);
  }

  @ApiOperation({
    summary: 'Histórico de transações do clube, com summary (RN17)',
  })
  @Get('clubs/:id/transactions')
  transactions(@ClubId() id: number, @Query() query: RawQuery) {
    return this.marketService.getTransactions(
      id,
      parseTransactionsFilter(query),
    );
  }

  @ApiOperation({ summary: 'Histórico em CSV, com os mesmos filtros (RN18)' })
  @Get('clubs/:id/transactions/export')
  async exportTransactions(
    @ClubId() id: number,
    @Query() query: RawQuery,
    @Res() response: Response,
  ) {
    const csv = await this.marketService.exportTransactions(
      id,
      parseTransactionsFilter(query),
    );
    response.status(200).type('text/csv; charset=utf-8').send(csv);
  }
}
