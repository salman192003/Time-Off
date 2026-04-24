import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  VersionColumn, 
  Index 
} from 'typeorm';

@Entity()
@Index(['employeeId', 'locationId'], { unique: true })
export class BalanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  employeeId: string;

  @Column()
  locationId: string;

  @Column('float')
  availableDays: number;

  @Column('float', { default: 0 })
  pendingDays: number;

  @Column({ type: 'datetime' })
  lastSyncedAt: Date;

  @VersionColumn()
  version: number;
}
