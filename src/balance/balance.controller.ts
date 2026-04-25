import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { Balance } from './balance.entity';

@Controller('balances')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get(':employeeId')
  async findAll(@Param('employeeId') employeeId: string): Promise<Balance[]> {
    return this.balanceService.findAllForEmployee(employeeId);
  }

  @Get(':employeeId/:locationId')
  async findFiltered(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<Balance> {
    const balances = await this.balanceService.findAllForEmployee(employeeId);
    const result = balances.find(b => b.locationId === locationId);
    if (!result) {
      throw new NotFoundException();
    }
    return result;
  }
}
