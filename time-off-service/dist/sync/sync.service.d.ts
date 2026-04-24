import { Repository, DataSource } from 'typeorm';
import { BalanceRecord } from '../entities/balance-record.entity';
import { TimeOffRequest } from '../entities/time-off-request.entity';
import { SyncLog } from '../entities/sync-log.entity';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookSyncDto } from './dto/webhook-sync.dto';
export declare class SyncService {
    private dataSource;
    private readonly balanceRepository;
    private readonly requestRepository;
    private readonly syncLogRepository;
    constructor(dataSource: DataSource, balanceRepository: Repository<BalanceRecord>, requestRepository: Repository<TimeOffRequest>, syncLogRepository: Repository<SyncLog>);
    private reconcileEmployeeBalance;
    processBatchSync(dto: BatchSyncDto): Promise<{
        success: boolean;
        updated: number;
        rejected: number;
    }>;
    processWebhook(dto: WebhookSyncDto): Promise<{
        success: boolean;
        updated: number;
        rejected: number;
    }>;
}
