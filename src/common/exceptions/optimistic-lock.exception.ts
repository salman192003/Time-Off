import { HttpException, HttpStatus } from '@nestjs/common';

export class OptimisticLockException extends HttpException {
  constructor(message: string = 'Optimistic lock conflict') {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message,
        code: 'OPTIMISTIC_LOCK_CONFLICT',
      },
      HttpStatus.CONFLICT,
    );
  }
}
