import { Controller, Post, Get, Body, Headers, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncLog } from './sync-log.entity';
import { HcmBalanceRecord } from '../hcm/hcm.client';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  private checkSecret(secret: string) {
    const expected = process.env.HCM_SECRET;
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing x-hcm-secret header');
    }
  }

  @Post('batch')
  async batch(
    @Headers('x-hcm-secret') secret: string,
    @Body('records') records: HcmBalanceRecord[],
  ): Promise<SyncLog> {
    this.checkSecret(secret);
    if (!Array.isArray(records)) {
      throw new BadRequestException('records must be an array');
    }
    for (const r of records) {
      if (!r.employeeId || !r.locationId || !r.leaveType || r.availableDays === undefined) {
        throw new BadRequestException('Malformed batch payload');
      }
    }
    return this.syncService.processBatch(records);
  }

  @Post('realtime')
  async realtime(
    @Headers('x-hcm-secret') secret: string,
    @Body() body: { employeeId: string; locationId: string; leaveType: string; availableDays: number },
  ): Promise<{ success: boolean }> {
    this.checkSecret(secret);
    if (!body || !body.employeeId || !body.locationId || !body.leaveType || body.availableDays === undefined) {
      throw new BadRequestException('Malformed realtime payload');
    }
    await this.syncService.processRealtimeUpdate(
      body.employeeId,
      body.locationId,
      body.leaveType,
      body.availableDays,
    );
    return { success: true };
  }

  @Get('logs')
  async getLogs(): Promise<SyncLog[]> {
    return this.syncService.getLogs();
  }
}
