import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { HcmClient } from './hcm.client';
import { HcmMockController } from './hcm-mock.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [HcmClient],
  controllers: [HcmMockController],
  exports: [HcmClient],
})
export class HcmModule {}
