export declare enum SyncType {
    BATCH = "BATCH",
    WEBHOOK = "WEBHOOK",
    REALTIME = "REALTIME"
}
export declare enum SyncStatus {
    SUCCESS = "SUCCESS",
    PARTIAL = "PARTIAL",
    FAILED = "FAILED"
}
export declare class SyncLog {
    id: string;
    type: SyncType;
    triggeredBy: string;
    affectedEmployees: number;
    requestsRevalidated: number;
    requestsAutoRejected: number;
    status: SyncStatus;
    errorDetail: string;
    createdAt: Date;
}
