import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MockHcmController } from './mock-hcm.controller';
import { MockHcmService } from './mock-hcm.service';

@Module({
  imports: [HttpModule],
  controllers: [MockHcmController],
  providers: [MockHcmService]
})
export class MockHcmModule {}
