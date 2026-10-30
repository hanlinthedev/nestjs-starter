import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { HumanReadableConsoleLogger } from './common/observability/human-readable-console.logger.js';
import { logLevels, type EnvironmentVariables } from './config/environment.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<EnvironmentVariables, true>);
  const development =
    config.getOrThrow('ENVIRONMENT', { infer: true }) === 'development';
  app.useLogger(
    new HumanReadableConsoleLogger({
      json: !development,
      colors: development,
      structuredParams: true,
      flattenParams: true,
      logLevels: logLevels.slice(
        logLevels.indexOf(config.getOrThrow('LOG_LEVEL', { infer: true })),
      ),
    }),
  );
  app.flushLogs();
  setupApp(app);
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow('PORT', { infer: true }), '0.0.0.0');
}
void bootstrap().catch(() => {
  console.error(
    'Application bootstrap failed. Check configuration and service availability.',
  );
  process.exitCode = 1;
});
