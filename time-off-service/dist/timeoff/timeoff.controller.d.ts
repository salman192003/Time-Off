import { TimeoffService } from './timeoff.service';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class TimeoffController {
    private readonly timeoffService;
    constructor(timeoffService: TimeoffService);
    getBalance(employeeId: string, locationId: string): Promise<{
        effectiveBalance: number;
        id: string;
        employeeId: string;
        locationId: string;
        availableDays: number;
        pendingDays: number;
        lastSyncedAt: Date;
        version: number;
    }>;
    createRequest(dto: CreateTimeOffRequestDto): Promise<import("../entities/time-off-request.entity").TimeOffRequest>;
    getRequest(id: string): Promise<import("../entities/time-off-request.entity").TimeOffRequest>;
    updateRequestStatus(id: string, dto: UpdateStatusDto): Promise<import("../entities/time-off-request.entity").TimeOffRequest>;
}
