import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor.js';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';
import { requestContextMiddleware } from './common/observability/request-context.middleware.js';
import { applyZodSchemasToSwagger } from './common/swagger/zod-swagger.js';
import type { EnvironmentVariables } from './config/environment.js';

export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const production =
    config.getOrThrow('ENVIRONMENT', { infer: true }) === 'production';
  app.useSecurityHeaders(
    production
      ? {
          strictTransportSecurity: {
            maxAge: 31536000,
            includeSubDomains: true,
          },
        }
      : {
          contentSecurityPolicy: {
            directives: { upgradeInsecureRequests: null },
          },
          strictTransportSecurity: false,
        },
  );
  app.use(requestContextMiddleware);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: config.getOrThrow('CORS_ORIGIN', { infer: true }),
    exposedHeaders: ['X-Request-Id'],
  });
  if (!production) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('API Starter')
        .setDescription(
          'NestJS REST API starter. Responses use { success, data } or { success, message, errors? }.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    applyZodSchemasToSwagger(document, app.get(ModulesContainer));
    SwaggerModule.setup('api', app, document);
  }
}
