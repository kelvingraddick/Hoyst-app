#!/usr/bin/env node
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dashboardDefinition} from './lib/beta-dashboard.mjs';
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify(dashboardDefinition, null, 2));
} else {
  const host = process.env.POSTHOG_API_HOST ?? 'https://us.posthog.com';
  const project = process.env.POSTHOG_PROJECT_ID;
  const token = process.env.POSTHOG_PERSONAL_API_KEY;
  if (
    !['https://us.posthog.com', 'https://eu.posthog.com'].includes(host) ||
    !/^\d+$/.test(project ?? '') ||
    !token
  ) {
    throw new Error(
      'Set POSTHOG_API_HOST, numeric POSTHOG_PROJECT_ID and a POSTHOG_PERSONAL_API_KEY in the process environment. Never put the personal key in app or website configuration.',
    );
  }
  const base = `${host}/api/projects/${project}/`;
  async function request(path, method = 'GET', body) {
    const response = await fetch(new URL(path, base), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok)
      throw new Error(
        `PostHog ${method} ${path.split('?')[0]} failed (${
          response.status
        }). No credentials or provider error body were logged.`,
      );
    return response.json();
  }
  const statePath = '.beta-private/posthog-dashboard.json';
  let state = {project, host, insights: {}};
  try {
    const saved = JSON.parse(await readFile(statePath, 'utf8'));
    if (saved.project === project && saved.host === host) state = saved;
  } catch {
    /* first run */
  }
  await mkdir('.beta-private', {recursive: true, mode: 0o700});
  async function save() {
    await writeFile(statePath, JSON.stringify(state, null, 2), {mode: 0o600});
  }
  if (!state.dashboard) {
    // Reuse a dashboard authored in the UI, including the initial beta setup.
    let path = 'dashboards/?limit=100';
    while (path && !state.dashboard) {
      const page = await request(path);
      const matches = page.results.filter(
        item => item.name === dashboardDefinition.name && !item.deleted,
      );
      if (matches.length > 1)
        throw new Error(
          'Multiple matching dashboards exist. Save the intended dashboard ID in the private state before applying.',
        );
      if (matches.length === 1) state.dashboard = matches[0].id;
      path = page.next
        ? new URL(page.next).pathname.replace(new URL(base).pathname, '') +
          new URL(page.next).search
        : '';
    }
  }
  if (!state.dashboard) {
    const created = await request('dashboards/', 'POST', {
      name: dashboardDefinition.name,
      description: dashboardDefinition.description,
      pinned: true,
    });
    state.dashboard = created.id;
    await save();
  }
  const existing = await request(`dashboards/${state.dashboard}/`);
  for (const tile of existing.tiles ?? []) {
    const insight = tile.insight;
    if (insight?.id && insight.name && !tile.deleted)
      state.insights[insight.name] ??= insight.id;
  }
  await save();
  for (const insight of dashboardDefinition.insights) {
    // Validate each SQL query against the actual PostHog engine before saving its card.
    const source = insight.query.source;
    await request('query/', 'POST', {query: source});
    const id = state.insights[insight.name];
    const result = await request(
      id ? `insights/${id}/` : 'insights/',
      id ? 'PATCH' : 'POST',
      {...insight, saved: true, dashboards: [state.dashboard]},
    );
    state.insights[insight.name] = result.id;
    await save();
  }
  console.log(
    `Saved dashboard: ${host}/project/${project}/dashboard/${state.dashboard}`,
  );
}
