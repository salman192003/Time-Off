import { Test, TestingModule } from '@nestjs/testing';
import { HcmClient } from './hcm.client';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InsufficientBalanceException } from '../common/exceptions/insufficient-balance.exception';
import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError, delay as rxjsDelay, defer } from 'rxjs';

describe('Group 8: HCM CLIENT RESILIENCE (hcm.client.spec.ts — Unit)', () => {
  let hcmClient: HcmClient;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HcmClient,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
          },
        },
      ],
    }).compile();

    hcmClient = module.get<HcmClient>(HcmClient);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Test 8.1: HCM returns 422 on applyDebit -> InsufficientBalanceException with HCM tag', async () => {
    const error422 = {
      response: {
        status: 422,
        data: { code: 'INSUFFICIENT_BALANCE' },
      },
    };
    jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error422));

    try {
      await hcmClient.applyDebit('emp-1', 'loc-a', 'annual', 2);
      throw new Error('Should have failed');
    } catch (e: any) {
      expect(e).toBeInstanceOf(InsufficientBalanceException);
      expect(e.message).toBe('HCM: Insufficient Balance');
    }
  });

  it('Test 8.2: HCM returns 503 three times -> ServiceUnavailableException after retry exhaustion', async () => {
    const error503 = { response: { status: 503 } };
    let subs = 0;
    const source = defer(() => {
      subs++;
      return throwError(() => error503);
    });
    jest.spyOn(httpService, 'post').mockReturnValue(source as any);

    const startTime = Date.now();
    try {
       await hcmClient.applyDebit('emp-1', 'loc-a', 'annual', 2);
       throw new Error('Should have failed');
    } catch (e: any) {
       expect(e).toBeInstanceOf(ServiceUnavailableException);
    }
    const duration = Date.now() - startTime;

    expect(duration).toBeGreaterThanOrEqual(1300); // 200 + 400 + 800 = 1400ms delay
    expect(httpService.post).toHaveBeenCalledTimes(1); 
    expect(subs).toBe(4); // 1 initial + 3 retries
  }, 10000);

  it('Test 8.3: HCM returns 503 twice then 200 -> resolves successfully (retry succeeded)', async () => {
    const error503 = { response: { status: 503 } };
    const successResponse = { data: { success: true }, status: 200, statusText: 'OK', headers: {}, config: {} };

    let subs = 0;
    const source = defer(() => {
      subs++;
      if (subs <= 2) return throwError(() => error503);
      return of(successResponse);
    });
    jest.spyOn(httpService, 'post').mockReturnValue(source as any);

    await hcmClient.applyDebit('emp-1', 'loc-a', 'annual', 2);
    expect(httpService.post).toHaveBeenCalledTimes(1);
    expect(subs).toBe(3);
  });

  it('Test 8.4: HCM response delayed 6000ms -> timeout after 5000ms throws error', async () => {
    jest.useFakeTimers();

    let subs = 0;
    const slowResponse = defer(() => {
      subs++;
      return of({ data: { success: true } }).pipe(rxjsDelay(6000));
    });
    jest.spyOn(httpService, 'post').mockReturnValue(slowResponse as any);

    const promise = hcmClient.applyDebit('emp-1', 'loc-a', 'annual', 2).catch(e => e);

    // Fast-forward processing of all timers so timeouts and retries immediately trigger
    await jest.runAllTimersAsync();

    const error = await promise;
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(httpService.post).toHaveBeenCalledTimes(1);
    expect(subs).toBe(4); // 1 initial + 3 retries due to timeout throws
    
    jest.useRealTimers();
  });

  it('Test 8.5: getBatchBalances() returns 503 -> ServiceUnavailableException after retries', async () => {
    const error503 = { response: { status: 503 } };
    let subs = 0;
    const source = defer(() => {
      subs++;
      return throwError(() => error503);
    });
    jest.spyOn(httpService, 'get').mockReturnValue(source as any);

    await expect(hcmClient.getBatchBalances()).rejects.toThrow(ServiceUnavailableException);
    expect(httpService.get).toHaveBeenCalledTimes(1);
    expect(subs).toBe(4); // 1 initial + 3 retries
  }, 10000);

  it('Test 8.6: getBatchBalances() returns 200 -> resolves with records array', async () => {
    const mockRecords = [
      { employeeId: 'emp-1', locationId: 'loc-a', leaveType: 'annual', availableDays: 10 },
      { employeeId: 'emp-2', locationId: 'loc-b', leaveType: 'sick', availableDays: 5 },
    ];
    const successResponse = { data: mockRecords, status: 200, statusText: 'OK', headers: {}, config: {} };

    jest.spyOn(httpService, 'get').mockReturnValue(of(successResponse as any));

    const result = await hcmClient.getBatchBalances();
    expect(result).toEqual(mockRecords);
    expect(result).toHaveLength(2);
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });
});
