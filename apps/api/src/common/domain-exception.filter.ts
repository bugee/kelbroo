import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { MoneySplitError, OrderTransitionError } from '@kelbroo/types';

/**
 * Błędy domenowe z `packages/types` nie są wyjątkami HTTP — bez tłumaczenia
 * wypadały jako 500 „Internal server error", przez co kelner widziałby awarię
 * zamiast informacji, że zamówienia nie da się cofnąć.
 */
@Catch(OrderTransitionError, MoneySplitError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: OrderTransitionError | MoneySplitError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof OrderTransitionError) {
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: `Nie można zmienić statusu z „${exception.from}" na „${exception.to}".`,
        error: 'Conflict',
      });
      return;
    }

    // Rozjechany podział rachunku to błąd po naszej stronie, nie żądania.
    this.logger.error(exception.message, exception.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Błąd rozliczenia rachunku. Zgłoś to obsłudze technicznej.',
      error: 'Internal Server Error',
    });
  }
}

export { HttpException };
