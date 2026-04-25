import { HttpException, HttpStatus } from '@nestjs/common';

export class ConflictException extends HttpException {
  constructor(message: string = 'State conflict') {
    super(
      {
        statusCode: HttpStatus.CONFLICT,
        message,
        code: 'STATE_CONFLICT',
      },
      HttpStatus.CONFLICT,
    );
  }
}
