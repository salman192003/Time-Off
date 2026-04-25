import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientBalanceException extends HttpException {
  constructor(message: string = 'Insufficient balance') {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message,
        code: 'INSUFFICIENT_BALANCE',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
