import { HttpService } from '@nestjs/axios';
import { Repository, DataSource } from 'typeorm';
import { SyncService } from '../sync/sync.service';
import { TimeOffRequest } from '../entities/time-off-request.entity';
import { BalanceRecord } from '../entities/balance-record.entity';
export declare class SchedulerService {
    private readonly httpService;
    private readonly syncService;
    private readonly dataSource;
    private readonly requestRepository;
    private readonly balanceRepository;
    private readonly logger;
    constructor(httpService: HttpService, syncService: SyncService, dataSource: DataSource, requestRepository: Repository<TimeOffRequest>, balanceRepository: Repository<BalanceRecord>);
    runBatchReconciliation(): Promise<void>;
    retryPendingRequests(): Promise<void>;
}
