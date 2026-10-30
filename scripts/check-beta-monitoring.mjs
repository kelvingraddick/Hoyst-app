#!/usr/bin/env node
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
if (!process.argv.includes('--send')) {
  console.log(
    'Pass --send to send one generic configuration-check event to the configured Sentry project. This checks transport only, not native crash capture or symbolication.',
  );
} else {
  process.loadEnvFile('.env');
  const require = createRequire(
    new URL('../functions/package.json', import.meta.url),
  );
  const Sentry = require('@sentry/node');
  const project = await readFile('ios/Hoyst.xcodeproj/project.pbxproj', 'utf8');
  const build =
    project.match(/CURRENT_PROJECT_VERSION = (\d+);/)?.[1] ?? 'unknown';
  const version =
    project.match(/MARKETING_VERSION = ([^;]+);/)?.[1] ?? 'unknown';
  if (!process.env.SENTRY_DSN?.startsWith('https://'))
    throw new Error('Configure SENTRY_DSN in the ignored .env first.');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'configuration-check',
    release: `hoyst@${version}+${build}`,
    dist: build,
    defaultIntegrations: false,
    sendDefaultPii: false,
    serverName: 'hoyst-configuration-check',
  });
  Sentry.captureEvent({
    message: 'Hoyst beta monitoring configuration check',
    level: 'info',
    tags: {verification_kind: 'transport_only'},
  });
  const flushed = await Sentry.flush(10000);
  if (!flushed)
    throw new Error('The monitoring check did not flush successfully.');
  console.log(
    `Configuration-check event delivered for Hoyst ${version} (${build}). Verify it in Sentry; native crash capture and symbolication still need a release-device check.`,
  );
}
