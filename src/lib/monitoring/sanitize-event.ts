import type {Event} from '@sentry/react-native';

/** Keep diagnostic structure and build metadata, without application content. */
export function sanitizeMonitoringEvent(
  event: Event,
): Event & {type: undefined} {
  const contexts: Event['contexts'] = {};
  const fields = {
    app: ['app_identifier', 'app_version', 'app_build', 'in_foreground'],
    os: ['name', 'version', 'build', 'kernel_version', 'rooted'],
    device: ['family', 'model', 'model_id', 'arch', 'simulator', 'orientation'],
    runtime: ['name', 'version'],
  };
  for (const [kind, keys] of Object.entries(fields)) {
    const original = event.contexts?.[kind];
    if (!original) {
      continue;
    }
    const safe: Record<string, string | number | boolean> = {};
    for (const key of keys) {
      const value = original[key];
      if (['string', 'number', 'boolean'].includes(typeof value)) {
        safe[key] = value as string | number | boolean;
      }
    }
    contexts[kind] = safe;
  }
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta,
    contexts,
    exception: event.exception
      ? {
          values: event.exception.values?.map(value => ({
            type: value.type,
            value: 'Error details withheld for privacy',
            mechanism: value.mechanism
              ? {type: value.mechanism.type, handled: value.mechanism.handled}
              : undefined,
            stacktrace: value.stacktrace
              ? {
                  frames: value.stacktrace.frames?.map(frame => ({
                    filename: frame.filename?.split(/[?#]/)[0],
                    function: frame.function,
                    module: frame.module,
                    lineno: frame.lineno,
                    colno: frame.colno,
                    in_app: frame.in_app,
                    instruction_addr: frame.instruction_addr,
                  })),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}
