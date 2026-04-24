import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BalanceRecord } from './entities/balance-record.entity';
import { TimeOffRequest } from './entities/time-off-request.entity';
import { SyncLog } from './entities/sync-log.entity';
import { TimeoffModule } from './timeoff/timeoff.module';
import { SyncModule } from './sync/sync.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MockHcmModule } from './mock-hcm/mock-hcm.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      entities: [BalanceRecord, TimeOffRequest, SyncLog],
      synchronize: true, // Set to false in production!
    }),
    ScheduleModule.forRoot(),
    TimeoffModule,
    SyncModule,
    MockHcmModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
