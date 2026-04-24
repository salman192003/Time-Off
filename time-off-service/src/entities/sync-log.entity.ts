import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn 
} from 'typeorm';

export enum SyncType {
  BATCH = 'BATCH',
  WEBHOOK = 'WEBHOOK',
  REALTIME = 'REALTIME',
}

export enum SyncStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

@Entity()
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', enum: SyncType })
  type: SyncType;

  @Column()
  triggeredBy: string;

  @Column('int')
  affectedEmployees: number;

  @Column('int')
  requestsRevalidated: number;

  @Column('int')
  requestsAutoRejected: number;

  @Column({ type: 'varchar', enum: SyncStatus })
  status: SyncStatus;

  @Column({ type: 'text', nullable: true })
  errorDetail: string;

  @CreateDateColumn()
  createdAt: Date;
}
