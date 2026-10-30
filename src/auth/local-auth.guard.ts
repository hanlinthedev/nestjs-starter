import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { LoginDto } from '../contracts.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  override canActivate(context: ExecutionContext) {
    // Guards execute before controller pipes. Validate here before Passport reads the body.
    const request = context.switchToHttp().getRequest<Request>();
    request.body = new ZodValidationPipe().transform(request.body, {
      type: 'body',
      metatype: LoginDto,
    });
    return super.canActivate(context);
  }
}
