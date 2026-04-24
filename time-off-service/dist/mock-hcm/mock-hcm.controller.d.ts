import { MockHcmService } from './mock-hcm.service';
export declare class MockHcmController {
    private readonly mockHcmService;
    constructor(mockHcmService: MockHcmService);
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
