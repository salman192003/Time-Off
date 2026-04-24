import { Injectable, InternalServerErrorException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface EmployeeBalance {
  employeeId: string;
  locationId: string;
  balance: number;
}

@Injectable()
export class MockHcmService {
  private readonly logger = new Logger(MockHcmService.name);
  
  // In-memory array acting as our mock database
  private balances: EmployeeBalance[] = [
    { employeeId: 'emp-1', locationId: 'loc-A', balance: 15 },
    { employeeId: 'emp-2', locationId: 'loc-A', balance: 20 },
    { employeeId: 'emp-3', locationId: 'loc-B', balance: 10 },
  ];

  // Set for idempotency checks
  private processedRequests: Set<string> = new Set();

  constructor(private readonly httpService: HttpService) {}

  submitTimeOff(employeeId: string, locationId: string, days: number, requestId: string) {
    // Idempotency check
    if (this.processedRequests.has(requestId)) {
      this.logger.log(`Request ${requestId} already processed. Returning success idempotently.`);
      return { success: true, message: 'Request already processed' };
    }

    // Chaos Engineering: 10% chance to fail simulating downtime
    if (Math.random() < 0.1) {
      this.logger.warn(`Simulated HCM transient downtime for request ${requestId}`);
      throw new InternalServerErrorException('Simulated transient HCM error');
    }

    const employee = this.balances.find(
      b => b.employeeId === employeeId && b.locationId === locationId
    );

    if (!employee) {
      throw new BadRequestException('Employee not found in HCM');
    }

    // Business Logic
    if (days > employee.balance) {
      throw new BadRequestException('Insufficient balance in HCM');
    }

    employee.balance -= days;
    this.processedRequests.add(requestId);
    
    this.logger.log(`Successfully processed time off for ${employeeId}. New balance: ${employee.balance}`);
    return { success: true, balance: employee.balance };
  }

  getBatchBalances() {
    // Format to match the expected BatchSyncDto payload structure
    return {
      records: this.balances.map(b => ({
        employeeId: b.employeeId,
        locationId: b.locationId,
        availableDays: b.balance,
      })),
    };
  }

  async triggerWorkAnniversary(employeeId: string, locationId: string, extraDays: number) {
    const employee = this.balances.find(
      b => b.employeeId === employeeId && b.locationId === locationId
    );

    if (!employee) {
      throw new BadRequestException('Employee not found in HCM');
    }

    employee.balance += extraDays;
    this.logger.log(`Triggered work anniversary for ${employeeId}. Added ${extraDays} days. New balance: ${employee.balance}`);

    // Call our own webhook endpoint to sync the data back
    const payload = {
      employeeId: employee.employeeId,
      locationId: employee.locationId,
      availableDays: employee.balance,
    };

    try {
      await firstValueFrom(
        this.httpService.post('http://localhost:3000/sync/webhook', payload)
      );
      this.logger.log(`Successfully sent webhook update to ExampleHR for ${employeeId}`);
      return { success: true, newBalance: employee.balance, webhookSent: true };
    } catch (error) {
      this.logger.error(`Failed to send webhook to ExampleHR: ${error.message}`);
      return { 
        success: true, 
        newBalance: employee.balance, 
        webhookSent: false,
        error: error.message 
      };
    }
  }
}
