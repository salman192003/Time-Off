import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  FAILED_HCM_VALIDATION = 'FAILED_HCM_VALIDATION',
}

@Entity('time_off_request')
export class TimeOffRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() employeeId: string;

  @Column() locationId: string;

  @Column() leaveType: string;

  @Column('decimal', { precision: 10, scale: 2 }) daysRequested: number;

  @Column({ type: 'date' }) startDate: string;

  @Column({ type: 'date' }) endDate: string;

  @Column({ nullable: true }) managerId: string;

  @Column({ type: 'simple-enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status: RequestStatus;

  @CreateDateColumn() createdAt: Date;

  @Column({ nullable: true }) resolvedAt: Date;
}
