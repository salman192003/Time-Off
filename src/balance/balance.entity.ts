import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Unique } from 'typeorm';

@Entity('balance')
@Unique(['employeeId', 'locationId', 'leaveType'])
export class Balance {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() employeeId: string;

  @Column() locationId: string;

  @Column() leaveType: string;

  @Column('decimal', { precision: 10, scale: 2 }) availableDays: number;

  @Column({ default: 1 }) version: number;

  @Column({ nullable: true }) lastSyncedAt: Date;

  @UpdateDateColumn() updatedAt: Date;
}
