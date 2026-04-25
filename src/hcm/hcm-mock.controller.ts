import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import type { HcmBalanceRecord } from './hcm.client';

@Controller('mock-hcm')
export class HcmMockController {
  private balances: Map<string, number> = new Map();
  private config = { forceError: false, forceDelay: 0, silentSuccess: false };

  private getKey(employeeId: string, locationId: string, leaveType: string): string {
    return `${employeeId}:${locationId}:${leaveType}`;
  }

  private async sleep() {
    if (this.config.forceDelay > 0) {
      await new Promise(res => setTimeout(res, this.config.forceDelay));
    }
  }

  private checkError() {
    if (this.config.forceError) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('balance/:employeeId/:locationId')
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    this.checkError();
    await this.sleep();

    const prefix = `${employeeId}:${locationId}:`;
    let availableDays = 0;
    for (const [key, val] of this.balances.entries()) {
      if (key.startsWith(prefix)) {
        availableDays = val;
        break;
      }
    }
    return { availableDays };
  }

  @Get('batch')
  async getBatchBalances(): Promise<HcmBalanceRecord[]> {
    this.checkError();
    await this.sleep();

    const result: HcmBalanceRecord[] = [];
    for (const [key, availableDays] of this.balances.entries()) {
      const [employeeId, locationId, leaveType] = key.split(':');
      result.push({ employeeId, locationId, leaveType, availableDays });
    }
    return result;
  }

  @Post('balance')
  async upsertBalance(@Body() body: HcmBalanceRecord) {
    this.checkError();
    await this.sleep();

    const key = this.getKey(body.employeeId, body.locationId, body.leaveType);
    this.balances.set(key, Number(body.availableDays));
    return { updated: true };
  }

  @Post('apply-debit')
  async applyDebit(
    @Body() body: { employeeId: string; locationId: string; leaveType: string; days: number },
  ) {
    this.checkError();
    await this.sleep();

    if (this.config.silentSuccess) {
      return { success: true };
    }

    const key = this.getKey(body.employeeId, body.locationId, body.leaveType);
    const balance = this.balances.get(key) || 0;

    if (body.days > balance) {
      throw new HttpException({ code: 'INSUFFICIENT_BALANCE' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }

    this.balances.set(key, balance - body.days);
    return { success: true };
  }

  @Post('config')
  configMock(@Body() config: Partial<{ forceError: boolean; forceDelay: number; silentSuccess: boolean }>) {
    this.config = { ...this.config, ...config };
    return this.config;
  }

  @Post('reset')
  resetMock() {
    this.balances.clear();
    this.config = { forceError: false, forceDelay: 0, silentSuccess: false };
    return { reset: true };
  }

  @Post('seed')
  seedMock(@Body() body: { records: HcmBalanceRecord[] }) {
    for (const r of body.records) {
      const key = this.getKey(r.employeeId, r.locationId, r.leaveType);
      this.balances.set(key, Number(r.availableDays));
    }
    return { seeded: true };
  }
}
