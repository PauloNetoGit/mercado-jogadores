import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BuyPlayerDto } from './dto/buy-player.dto';
import { MarketService } from './market.service';

@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Post('players/:id/buy')
  @HttpCode(200)
  buy(@Param('id') id: string, @Body() dto: BuyPlayerDto) {
    return this.marketService.buy(id, dto);
  }

  @Post('players/:id/sell')
  @HttpCode(200)
  sell(@Param('id') id: string) {
    return this.marketService.sell(id);
  }

  @Get('clubs/:id/transactions')
  transactions(
    @Param('id') id: string,
    @Query('type') type?: string,
    @Query('player_id') playerId?: string,
  ) {
    return this.marketService.getTransactions(id, type, playerId);
  }

  @Get('clubs/:id/transactions/export')
  async exportTransactions(
    @Param('id') id: string,
    @Query('type') type: string | undefined,
    @Query('player_id') playerId: string | undefined,
    @Res() response: Response,
  ) {
    const csv = await this.marketService.exportTransactions(id, type, playerId);
    response.status(200).type('text/csv; charset=utf-8').send(csv);
  }
}
