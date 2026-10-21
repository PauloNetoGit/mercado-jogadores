import { Body, Controller, Get, Put } from '@nestjs/common';
import { ClubId } from '../common/parse-id.pipe';
import { UpdateLineupDto } from './dto/update-lineup.dto';
import { LineupsService } from './lineups.service';

@Controller('clubs/:id/lineup')
export class LineupsController {
  constructor(private readonly lineupsService: LineupsService) {}

  @Put()
  replace(@ClubId() clubId: number, @Body() dto: UpdateLineupDto) {
    return this.lineupsService.replace(clubId, dto);
  }

  @Get()
  findCurrent(@ClubId() clubId: number) {
    return this.lineupsService.findCurrent(clubId);
  }
}
