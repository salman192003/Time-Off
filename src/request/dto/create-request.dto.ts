import { IsString, IsNotEmpty, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @IsNumber()
  @Min(0.5)
  @Max(365)
  daysRequested: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
