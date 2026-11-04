import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (err: any) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Error validating input fields',
          errors: err.issues.map((issue) => {
            // Quando o schema valida um campo isolado (ex.: `@Param('id', pipe)`),
            // `issue.path` vem vazio — usamos o nome do parâmetro (`metadata.data`)
            // como fallback para ainda identificar o campo com problema.
            const path = issue.path.length > 0 ? issue.path.join('.') : (metadata.data ?? metadata.type);
            return `${path}: ${issue.message}`;
          }),
        });
      }
      throw new BadRequestException('Unhandled unknown error');
    }
  }
}
