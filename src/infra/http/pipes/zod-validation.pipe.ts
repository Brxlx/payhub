import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (err: any) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Error validating input fields',
          errors: err.issues.map((error) => `${error.path.join('.')}: ${error.message}`),
        });
      }
      throw new BadRequestException('Unhandled unknown error');
    }
  }
}
