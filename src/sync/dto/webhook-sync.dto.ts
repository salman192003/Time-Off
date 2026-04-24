import { IsString, IsNumber, Min } from 'class-validator';

export class WebhookSyncDto {
  @IsString()
  employeeId: string;

  @IsString()
  locationId: string;

  @IsNumber()
  @Min(0)
  availableDays: number;
}
