import { IsEnum } from 'class-validator';

export enum UpdateRequestStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class UpdateStatusDto {
  @IsEnum(UpdateRequestStatus)
  status: UpdateRequestStatus;
}
