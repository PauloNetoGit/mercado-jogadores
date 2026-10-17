import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { UpdateLineupDto } from './dto/update-lineup.dto';
import { LineupsService } from './lineups.service';

@Controller('clubs/:id/lineup')
export class LineupsController {
  constructor(private readonly lineupsService: LineupsService) {}

  @Put()
  replace(
    @Param('id', ParseIntPipe) clubId: number,
    @Body() dto: UpdateLineupDto,
  ) {
    return this.lineupsService.replace(clubId, dto);
  }

  @Get()
  findCurrent(@Param('id', ParseIntPipe) clubId: number) {
    return this.lineupsService.findCurrent(clubId);
  }
}
