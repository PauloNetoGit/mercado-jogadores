import {
  Body,
  Patch,
  Put,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  Delete,
} from '@nestjs/common';
import type { Response } from 'express';

import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';

@Controller('players')
export class PlayersController {
  constructor(
    private readonly playersService: PlayersService,
  ) {}

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlayerDto,
  ) {
    return this.playersService.update(id, dto);
  }

  @Patch(':id/condition')
  updateCondition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConditionDto,
  ) {
    return this.playersService.updateCondition(
      id,
      dto.condition,
    );
  }

  @Post()
  async create(
    @Body() dto: CreatePlayerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const player = await this.playersService.create(dto);

    response.setHeader(
      'Location',
      `/api/v1/players/${player.id}`,
    );

    return player;
  }

  @Get()
  findAll(@Query() query: QueryPlayersDto) {
    return this.playersService.findAll(
      query.page,
      query.limit,
      query,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    const player = await this.playersService.findOne(id);

    if (!player) {
      throw new NotFoundException(
        'Jogador não encontrado.',
      );
    }

    return player;
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.remove(id);
  }
}