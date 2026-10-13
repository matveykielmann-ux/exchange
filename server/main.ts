/**
 * Server entry point: validate configuration (fail closed), migrate, listen,
 * and shut down gracefully on SIGTERM/SIGINT.
 */
import { createApp } from './app';
import { ConfigError, loadConfig } from './config';

function start() {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (e) {
    if (e instanceof ConfigError) {
      process.stderr.write(`${e.message}\n\nSee .env.example and README_DEPLOY.md.\n`);
      process.exit(78); // EX_CONFIG
    }
    throw e;
  }
  const app = createApp(config);
  const log = app.ctx.log;
  if (config.mode === 'sandbox')
    log.warn('SANDBOX MODE: simulated providers only. No real funds move. Do not expose this instance publicly.');

  app.listen().catch((e: unknown) => {
    log.error('failed to listen', { err: e });
    process.exit(1);
  });

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info('shutting down', { signal });
    const force = setTimeout(() => {
      log.error('forced exit after shutdown timeout');
      process.exit(1);
    }, 15_000);
    force.unref();
    app
      .close()
      .then(() => process.exit(0))
      .catch((e: unknown) => {
        log.error('shutdown error', { err: e });
        process.exit(1);
      });
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('unhandledRejection', (e) => log.error('unhandled rejection', { err: e }));
}

start();
