import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClubId } from '../common/parse-id.pipe';
import { ClubsService } from './clubs.service';
import { CreateClubDto } from './dto/create-club.dto';
import { QueryClubsDto } from './dto/query-clubs.dto';

@ApiTags('Clubes')
@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @ApiOperation({ summary: 'Cria um clube com 300,00 de caixa (RN10)' })
  @Post()
  async create(
    @Body() dto: CreateClubDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const club = await this.clubsService.create(dto);
    response.setHeader('Location', `/api/v1/clubs/${club.id}`);
    return club;
  }

  @ApiOperation({
    summary: 'Lista os clubes, por nome ou por patrimônio (RN11)',
  })
  @Get()
  findAll(@Query() query: QueryClubsDto) {
    return this.clubsService.findAll(query.sort);
  }

  @ApiOperation({
    summary: 'Clube com elenco, contratos, valor do elenco e patrimônio (RN11)',
  })
  @Get(':id')
  findOne(@ClubId() id: number) {
    return this.clubsService.findOne(id);
  }
}
