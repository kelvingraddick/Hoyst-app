/** Local-only preview. Invite data is fictional; email delivery stays disabled. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {renderInvitePage} = require('../functions/lib/invites/page');
const {
  handleLaunchSignup,
  handleUpdatesConfirmation,
} = require('../functions/lib/updates');
const {UpdatesError} = require('../functions/lib/updates/service');
const db = new Proxy(
  {},
  {
    get() {
      throw new UpdatesError(
        503,
        'Email updates aren’t available just yet. Please try again soon.',
      );
    },
  },
);
const root = resolve('hosting');
const port = Number(process.env.WEBSITE_PORT || 4173);
const origin = `http://localhost:${port}`;
const deps = {
  db,
  secret: 'local-preview-with-no-email-delivery',
  origin,
  available: false,
  provider: {
    ready: async () => {
      throw new UpdatesError(
        503,
        'Email updates aren’t available just yet. Please try again soon.',
      );
    },
  },
};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};
const preview = {
  circleId: 'workout-demo',
  title: 'Workout Crew',
  commitment: 'Three workouts a week. In it together.',
  category: 'Fitness',
  cadenceLabel: 'Weekly',
  commitmentCadence: 'weekly',
  commitmentFrequency: {tapInsPerWeek: 3},
  memberCount: 4,
  maxSize: 8,
  isFull: false,
  joinMode: 'open',
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url, origin);
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (url.pathname.startsWith('/join/')) {
      let state = url.pathname.split('/')[2];
      const valid = [
        'workout-crew',
        'approval',
        'full',
        'invite-only',
      ].includes(state);
      res.writeHead(valid ? 200 : 404, {
        'Content-Type': 'text/html; charset=utf-8',
      });
      res.end(
        renderInvitePage({
          statusCode: valid ? 200 : 404,
          title: valid
            ? 'Join Workout Crew on Hoyst'
            : 'Invite no longer available',
          description: valid
            ? preview.commitment
            : 'This Circle invitation is no longer available. Ask the Circle owner for a new link.',
          inviteCode: valid ? 'workout123' : undefined,
          preview: valid
            ? {
                ...preview,
                isFull: state === 'full',
                memberCount: state === 'full' ? 8 : 4,
                joinMode:
                  state === 'approval'
                    ? 'request_to_join'
                    : state === 'invite-only'
                    ? 'invite_only'
                    : 'open',
              }
            : undefined,
        }),
      );
      return;
    }
    if (
      url.pathname === '/api/launch-signup' ||
      url.pathname === '/updates/confirm'
    ) {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 2048) {
          res.writeHead(413);
          res.end();
          return;
        }
      }
      req.body = req.headers['content-type']?.includes('application/json')
        ? JSON.parse(raw || '{}')
        : Object.fromEntries(new URLSearchParams(raw));
      req.query = Object.fromEntries(url.searchParams);
      req.ip = '127.0.0.1';
      req.get = name => req.headers[name.toLowerCase()];
      const response = {
        set(k, v) {
          if (typeof k === 'object') {
            for (const [key, value] of Object.entries(k)) {
              res.setHeader(key, value);
            }
          } else {
            res.setHeader(k, v);
          }
          return this;
        },
        status(code) {
          res.statusCode = code;
          return this;
        },
        send(body) {
          res.end(req.method === 'HEAD' ? '' : body);
          return this;
        },
        json(body) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
          return this;
        },
      };
      await (url.pathname === '/api/launch-signup'
        ? handleLaunchSignup
        : handleUpdatesConfirmation)(req, response, deps);
      return;
    }
    let pathname = decodeURIComponent(url.pathname);
    const file = resolve(
      root,
      '.' +
        (pathname === '/'
          ? '/index.html'
          : extname(pathname)
          ? pathname
          : pathname + '.html'),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
    });
    res.end(req.method === 'HEAD' ? '' : body);
  } catch {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Page not found.');
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    `Hoyst website preview: ${origin}. Local demo invites: /join/workout-crew, /join/approval, /join/full, /join/invite-only, /join/unavailable. Email delivery disabled.`,
  ),
);
