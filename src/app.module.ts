import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Balance } from './balance/balance.entity';
import { TimeOffRequest } from './request/request.entity';
import { SyncLog } from './sync/sync-log.entity';
import { BalanceModule } from './balance/balance.module';
import { RequestModule } from './request/request.module';
import { SyncModule } from './sync/sync.module';
import { HcmModule } from './hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'timeoff.db',
      entities: [Balance, TimeOffRequest, SyncLog],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    BalanceModule,
    RequestModule,
    SyncModule,
    HcmModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
