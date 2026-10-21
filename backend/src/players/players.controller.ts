import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PlayerId } from '../common/parse-id.pipe';
import type { RawQuery } from '../common/query-params';
import { CreatePlayerDto } from './dto/create-player.dto';
import { parsePlayersQuery } from './dto/query-players';
import { UpdateConditionDto } from './dto/update-condition.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { PlayersService } from './players.service';

@ApiTags('Jogadores')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @ApiOperation({
    summary: 'Lista paginada, com busca, filtros e ordenação (RN07)',
  })
  @Get()
  findAll(@Query() query: RawQuery) {
    return this.playersService.findAll(parsePlayersQuery(query));
  }

  @ApiOperation({ summary: 'Detalhes de um jogador' })
  @Get(':id')
  findOne(@PlayerId() id: number) {
    return this.playersService.findOne(id);
  }

  @ApiOperation({
    summary:
      'Cadastra um jogador livre e APTO; o valor base é calculado (RN06)',
  })
  @Post()
  async create(
    @Body() dto: CreatePlayerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const player = await this.playersService.create(dto);
    response.setHeader('Location', `/api/v1/players/${player.id}`);
    return player;
  }

  @ApiOperation({ summary: 'Edita nome, posição, agilidade e idade (RN08)' })
  @Put(':id')
  update(@PlayerId() id: number, @Body() dto: UpdatePlayerDto) {
    return this.playersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Altera a condição física' })
  @Patch(':id/condition')
  updateCondition(@PlayerId() id: number, @Body() dto: UpdateConditionDto) {
    return this.playersService.updateCondition(id, dto.condition);
  }

  @ApiOperation({ summary: 'Exclusão lógica de jogador livre (RN09)' })
  @Delete(':id')
  @HttpCode(204)
  remove(@PlayerId() id: number) {
    return this.playersService.remove(id);
  }
}
