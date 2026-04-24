import { HttpService } from '@nestjs/axios';
export declare class MockHcmService {
    private readonly httpService;
    private readonly logger;
    private balances;
    private processedRequests;
    constructor(httpService: HttpService);
    submitTimeOff(employeeId: string, locationId: string, days: number, requestId: string): {
        success: boolean;
        message: string;
        balance?: undefined;
    } | {
        success: boolean;
        balance: number;
        message?: undefined;
    };
    getBatchBalances(): {
        records: {
            employeeId: string;
            locationId: string;
            availableDays: number;
        }[];
    };
    triggerWorkAnniversary(employeeId: string, locationId: string, extraDays: number): Promise<{
        success: boolean;
        newBalance: number;
        webhookSent: boolean;
        error?: undefined;
    } | {
        success: boolean;
        newBalance: number;
        webhookSent: boolean;
        error: any;
    }>;
}
