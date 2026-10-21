import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MatchId } from '../common/parse-id.pipe';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  async create(
    @Body() dto: CreateMatchDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const match = await this.matchesService.create(dto);
    response.setHeader('Location', `/api/v1/matches/${match.id}`);
    return match;
  }

  @Get()
  findAll(@Query('club_id') clubId?: string) {
    return this.matchesService.findAll(clubId);
  }

  @Get(':id')
  findOne(@MatchId() id: number) {
    return this.matchesService.findOne(id);
  }
}
