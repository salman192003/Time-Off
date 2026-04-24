import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest } from '../entities/time-off-request.entity';
import { SyncLog } from '../entities/sync-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BalanceRecord, TimeOffRequest, SyncLog])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService] // Export SyncService so SchedulerModule can use it
})
export class SyncModule {}
