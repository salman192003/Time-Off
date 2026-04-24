import { Repository, DataSource } from 'typeorm';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest } from '../entities/time-off-request.entity';
import { CreateTimeOffRequestDto } from './dto/create-time-off-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
export declare class TimeoffService {
    private readonly dataSource;
    private readonly balanceRepository;
    private readonly requestRepository;
    constructor(dataSource: DataSource, balanceRepository: Repository<BalanceRecord>, requestRepository: Repository<TimeOffRequest>);
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
    createRequest(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest>;
    getRequest(id: string): Promise<TimeOffRequest>;
    updateRequestStatus(id: string, dto: UpdateStatusDto): Promise<TimeOffRequest>;
}
