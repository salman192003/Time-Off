import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './request.entity';
import { RequestService } from './request.service';
import { RequestController } from './request.controller';
import { BalanceModule } from '../balance/balance.module';
import { HcmModule } from '../hcm/hcm.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalanceModule,
    HcmModule,
    SyncModule,
  ],
  providers: [RequestService],
  controllers: [RequestController],
})
export class RequestModule {}
