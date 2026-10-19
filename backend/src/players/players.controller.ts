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
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateConditionDto } from './dto/update-condition.dto';

@ApiTags('Jogadores')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @ApiOperation({ summary: 'Atualizar os dados de um jogador' })
  @ApiParam({ name: 'id', description: 'ID do jogador', example: 1 })
  @ApiResponse({ status: 200, description: 'Jogador atualizado.' })
  @ApiResponse({ status: 404, description: 'Jogador não encontrado.' })
  @Put(':id')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlayerDto) {
    return this.playersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Atualizar a condição física do jogador' })
  @ApiParam({ name: 'id', description: 'ID do jogador', example: 1 })
  @ApiResponse({ status: 200, description: 'Condição atualizada.' })
  @ApiResponse({ status: 400, description: 'Transição de condição inválida.' })
  @Patch(':id/condition')
  @Patch(':id/condition')
  updateCondition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConditionDto,
  ) {
    return this.playersService.updateCondition(id, dto.condition);
  }

  @ApiOperation({ summary: 'Cadastrar um novo jogador' })
  @ApiResponse({ status: 201, description: 'Jogador cadastrado.' })
  @ApiResponse({ status: 400, description: 'Dados inválidos.' })

  @Post()
  async create(
    @Body() dto: CreatePlayerDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const player = await this.playersService.create(dto);


    response.setHeader('Location', `/api/v1/players/${player.id}`);

    return player;
  }

  @ApiOperation({ summary: 'Listar, pesquisar, filtrar e ordenar jogadores' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Itens por página',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Pesquisa por nome',
  })
  @ApiQuery({
    name: 'position',
    required: false,
    type: String,
    description: 'Posição do jogador',
  })
  @ApiQuery({
    name: 'club_id',
    required: false,
    type: Number,
    description: 'Filtrar por clube',
  })
  @ApiQuery({
    name: 'free',
    required: false,
    enum: ['true', 'false'],
    description: 'Filtrar jogadores livres ou vinculados a clubes',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de jogadores.' })
  @Get()
  @Get()
  findAll(@Query() query: QueryPlayersDto) {
    return this.playersService.findAll(query.page, query.limit, query);
  }

  @ApiOperation({ summary: 'Consultar um jogador pelo ID' })
  @ApiParam({ name: 'id', description: 'ID do jogador', example: 1 })
  @ApiResponse({ status: 200, description: 'Dados do jogador.' })
  @ApiResponse({ status: 404, description: 'Jogador não encontrado.' })
  @Get(':id')
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const player = await this.playersService.findOne(id);

    if (!player) {
      throw new NotFoundException('Jogador não encontrado.');
    }

    return player;
  }

  @ApiOperation({ summary: 'Excluir um jogador' })
  @ApiParam({ name: 'id', description: 'ID do jogador', example: 1 })
  @ApiResponse({ status: 200, description: 'Operação de exclusão concluída.' })
  @ApiResponse({ status: 404, description: 'Jogador não encontrado.' })
  @Delete(':id')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.remove(id);
  }
}
