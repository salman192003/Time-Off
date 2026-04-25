import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum SyncSource {
  BATCH = 'BATCH',
  REALTIME = 'REALTIME',
}

export enum SyncStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  PARTIAL = 'PARTIAL',
}

@Entity('sync_log')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'simple-enum', enum: SyncSource }) source: SyncSource;

  @Column({ type: 'simple-enum', enum: SyncStatus }) status: SyncStatus;

  @Column({ default: 0 }) recordsProcessed: number;

  @Column({ nullable: true, type: 'simple-json' }) errors: object;

  @CreateDateColumn() triggeredAt: Date;
}
