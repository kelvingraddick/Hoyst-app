#!/usr/bin/env node
import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
const effectiveDate = process.argv
  .find(value => value.startsWith('--effective-date='))
  ?.slice(17);
if (
  !effectiveDate ||
  !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ||
  new Date(effectiveDate).toISOString().slice(0, 10) !== effectiveDate
) {
  throw new Error(
    'Pass --effective-date=YYYY-MM-DD using the actual approved publication date.',
  );
}
const output = path.resolve(
  process.argv.find(value => value.startsWith('--output='))?.slice(9) ||
    'docs/legal-release',
);
if (output === path.resolve('hosting'))
  throw new Error(
    'Prepare candidates outside hosting, review them, then copy the approved files explicitly.',
  );
await mkdir(output, {recursive: true});
const formatted = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeZone: 'UTC',
}).format(new Date(effectiveDate));
for (const page of ['privacy', 'terms']) {
  let html = await readFile(`docs/legal-drafts/${page}.html`, 'utf8');
  html = html
    .replace(/\s*<aside class="draft"[\s\S]*?<\/aside>/, '')
    .replace(/\s*<p class="review">[\s\S]*?<\/p>/g, '')
    .replace(/\s*<meta name="robots"[^>]*\/>/, '')
    .replace(
      /<p class="date">[\s\S]*?<\/p>/,
      `<p class="date">Effective ${formatted}.</p>`,
    )
    .replace(/\(Draft\) \|/g, '|')
    .replace(/Draft Hoyst/g, 'Hoyst')
    .replace(/ draft"/g, '"')
    .replace(
      /© 2026 Hoyst\. Draft for review\./g,
      '© 2026 Hoyst. All rights reserved.',
    );
  html = html
    .replace(
      'provider details, and internal account fields are intended to',
      'provider details, and internal account fields',
    )
    .replace(
      'Once finalized and effective, these terms will govern your use\n                of Hoyst.',
      'These terms govern your use of Hoyst.',
    )
    .replace(' This draft itself is not an operative agreement.', '');
  if (
    /class="(?:review|placeholder)"|\[to be|Draft for review|Implementation required/.test(
      html,
    )
  )
    throw new Error(`Unresolved draft content in ${page}.`);
  await writeFile(path.join(output, `${page}.html`), html);
}
await copyFile('docs/legal-drafts/legal.css', path.join(output, 'legal.css'));
await mkdir(path.join(output, 'assets'), {recursive: true});
for (const name of ['hoyst-logo.png', 'hoyst-icon.png'])
  await copyFile(
    path.join('hosting/assets', name),
    path.join(output, 'assets', name),
  );
const homepage = (await readFile('hosting/index.html', 'utf8')).replace(
  '<footer>© 2026 Hoyst. All rights reserved.</footer>',
  '<footer>© 2026 Hoyst. All rights reserved. <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms</a></footer>',
);
await writeFile(path.join(output, 'index.html'), homepage);
await writeFile(
  path.join(output, 'REVIEW.md'),
  `Local release candidates only. Not published or adopted. Proposed effective date: ${effectiveDate}. Regenerate using the actual publication date after approval. Complete the rollout in ../legal-drafts/implementation.md before shipping the app.\n`,
);
console.log(
  `Prepared legal review candidates in ${output}. Nothing was published.`,
);
