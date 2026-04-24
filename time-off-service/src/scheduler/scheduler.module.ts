import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { SyncModule } from '../sync/sync.module';
import { TimeOffRequest } from '../entities/time-off-request.entity';
import { BalanceRecord } from '../entities/balance-record.entity';

@Module({
  imports: [
    HttpModule,
    SyncModule,
    TypeOrmModule.forFeature([TimeOffRequest, BalanceRecord])
  ],
  providers: [SchedulerService]
})
export class SchedulerModule {}
