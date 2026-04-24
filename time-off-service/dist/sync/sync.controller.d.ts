import { SyncService } from './sync.service';
import { BatchSyncDto } from './dto/batch-sync.dto';
import { WebhookSyncDto } from './dto/webhook-sync.dto';
export declare class SyncController {
    private readonly syncService;
    constructor(syncService: SyncService);
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
