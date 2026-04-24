export declare enum RequestStatus {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED"
}
export declare class TimeOffRequest {
    id: string;
    employeeId: string;
    locationId: string;
    days: number;
    startDate: Date;
    endDate: Date;
    status: RequestStatus;
    hcmSubmittedAt: Date;
    hcmError: string;
    createdAt: Date;
    updatedAt: Date;
}
