import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LineupsController } from './lineups.controller';
import { LineupsService } from './lineups.service';

@Module({
  imports: [PrismaModule],
  controllers: [LineupsController],
  providers: [LineupsService],
  exports: [LineupsService],
})
export class LineupsModule {}
