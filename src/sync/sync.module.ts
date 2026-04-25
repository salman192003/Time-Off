import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncLog } from './sync-log.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncSchedulerService } from './sync-scheduler.service';
import { HcmModule } from '../hcm/hcm.module';
import { BalanceModule } from '../balance/balance.module';
import { TimeOffRequest } from '../request/request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncLog, TimeOffRequest]),
    HcmModule,
    BalanceModule,
  ],
  providers: [SyncService, SyncSchedulerService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
