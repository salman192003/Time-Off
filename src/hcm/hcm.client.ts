import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InsufficientBalanceException } from '../common/exceptions/insufficient-balance.exception';
import { catchError, retry, timeout } from 'rxjs/operators';
import { firstValueFrom, throwError, timer } from 'rxjs';

export interface HcmBalanceRecord {
  employeeId: string;
  locationId: string;
  leaveType: string;
  availableDays: number;
}

@Injectable()
export class HcmClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.configService.get<string>('HCM_BASE_URL') || 'http://localhost:3000';
  }

  async getBalance(employeeId: string, locationId: string): Promise<{ availableDays: number }> {
    const url = `${this.baseUrl}/mock-hcm/balance/${employeeId}/${locationId}`;
    const { data } = await firstValueFrom(
      this.httpService.get(url).pipe(
        timeout(5000),
        retry({
          count: 3,
          delay: (error, retryCount) => timer(200 * Math.pow(2, retryCount - 1))
        }),
        catchError(err => throwError(() => err))
      )
    );
    return data;
  }

  async applyDebit(employeeId: string, locationId: string, leaveType: string, days: number): Promise<void> {
    const url = `${this.baseUrl}/mock-hcm/apply-debit`;
    try {
      await firstValueFrom(
        this.httpService.post(url, { employeeId, locationId, leaveType, days }).pipe(
          timeout(5000),
          retry({
            count: 3,
            delay: (error, retryCount) => {
              if (error.response && error.response.status === 422) {
                return throwError(() => error);
              }
              return timer(200 * Math.pow(2, retryCount - 1));
            }
          }),
        )
      );
    } catch (err: any) {
      if (err.response?.status === 422 || (err.response?.data && err.response?.data?.code === 'INSUFFICIENT_BALANCE')) {
        throw new InsufficientBalanceException('HCM: Insufficient Balance');
      }
      throw new ServiceUnavailableException('HCM Service Unavailable');
    }
  }

  async getBatchBalances(): Promise<HcmBalanceRecord[]> {
    const url = `${this.baseUrl}/mock-hcm/batch`;
    const { data } = await firstValueFrom(
      this.httpService.get<HcmBalanceRecord[]>(url).pipe(
        timeout(5000),
        retry({
          count: 3,
          delay: (error, retryCount) => timer(200 * Math.pow(2, retryCount - 1))
        }),
        catchError(err => throwError(() => new ServiceUnavailableException('HCM Service Unavailable')))
      )
    );
    return data;
  }
}
