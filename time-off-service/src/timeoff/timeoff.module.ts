import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeoffController } from './timeoff.controller';
import { TimeoffService } from './timeoff.service';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest } from '../entities/time-off-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceRecord, TimeOffRequest])],
  controllers: [TimeoffController],
  providers: [TimeoffService]
})
export class TimeoffModule {}
