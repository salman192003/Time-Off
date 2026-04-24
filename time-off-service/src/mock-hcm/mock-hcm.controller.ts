import { Controller, Get, Post, Body } from '@nestjs/common';
import { MockHcmService } from './mock-hcm.service';

/**
 * MOCK HCM CONTROLLER (TESTING UTILITY ONLY)
 * 
 * This controller simulates an external HR system acting as the source of truth
 * for time-off balances. It mimics network unreliability and handles mocked
 * webhooks for out-of-band updates.
 */
@Controller('mock-hcm')
export class MockHcmController {
  constructor(private readonly mockHcmService: MockHcmService) {}

  @Post('submit')
  submitTimeOff(
    @Body('employeeId') employeeId: string,
    @Body('locationId') locationId: string,
    @Body('days') days: number,
    @Body('requestId') requestId: string,
  ) {
    return this.mockHcmService.submitTimeOff(employeeId, locationId, days, requestId);
  }

  @Get('batch')
  getBatchBalances() {
    return this.mockHcmService.getBatchBalances();
  }

  @Post('trigger-anniversary')
  triggerWorkAnniversary(
    @Body('employeeId') employeeId: string,
    @Body('locationId') locationId: string,
    @Body('extraDays') extraDays: number,
  ) {
    return this.mockHcmService.triggerWorkAnniversary(employeeId, locationId, extraDays);
  }
}
