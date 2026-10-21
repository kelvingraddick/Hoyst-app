import {sanitizeMonitoringEvent} from '../src/lib/monitoring/sanitize-event';

test('error reports keep build and stack information but exclude content and request details', () => {
  const result = sanitizeMonitoringEvent({
    release: 'hoyst@1.0+50',
    dist: '50',
    environment: 'beta',
    user: {id: 'private-user', email: 'private@example.invalid'},
    message: 'private message',
    extra: {commitment: 'private commitment'},
    tags: {url: 'https://hoyst.app/join/private-code'},
    request: {url: 'https://example.invalid/private'},
    contexts: {
      device: {model: 'iPhone', name: 'private name'},
      custom: {note: 'private note'},
    },
    breadcrumbs: [{message: 'private breadcrumb'}],
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'private error',
          mechanism: {
            type: 'generic',
            handled: true,
            data: {content: 'private mechanism'},
          },
          stacktrace: {
            frames: [
              {
                filename: 'app:///main.jsbundle?private',
                function: 'saveTapIn',
                lineno: 42,
                vars: {content: 'private vars'},
                context_line: 'private code',
              },
            ],
          },
        },
      ],
    },
  });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(result.release).toBe('hoyst@1.0+50');
  expect(result.contexts?.device?.model).toBe('iPhone');
  expect(result.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual(
    expect.objectContaining({
      filename: 'app:///main.jsbundle',
      function: 'saveTapIn',
      lineno: 42,
    }),
  );
});
