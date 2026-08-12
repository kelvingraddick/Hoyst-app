import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import {
  isCircleActivityEvent,
  normalizeLegacyMemberCopy,
} from '../src/features/inbox/circle-activity-compat';
import {
  legacyCircleActivityEventTypes,
  legacyCircleActivityFeedCategory,
  type CommitmentCadence,
  type CommitmentPace,
  type InboxEvent,
} from '../src/types/models';

const productionRoots = [
  path.join(__dirname, '..', 'src'),
  path.join(__dirname, '..', 'functions', 'src'),
];

const legacyWireFiles = new Set([
  path.join(
    __dirname,
    '..',
    'functions',
    'src',
    'shared',
    'notification-compat.ts',
  ),
  path.join(
    __dirname,
    '..',
    'src',
    'features',
    'inbox',
    'circle-activity-compat.ts',
  ),
  path.join(__dirname, '..', 'src', 'types', 'models.ts'),
]);

function getProductionFiles(directory: string): string[] {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return getProductionFiles(entryPath);
    }

    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function getVisibleStringFragments(filePath: string) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const fragments: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      fragments.push(node.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return fragments;
}

describe('canonical product language', () => {
  it('keeps retired terms out of production-visible strings', () => {
    const violations = productionRoots
      .flatMap(getProductionFiles)
      .filter(filePath => !legacyWireFiles.has(filePath))
      .flatMap(filePath =>
        getVisibleStringFragments(filePath).flatMap(fragment => {
          const withoutGoalRange = fragment.replace(/Goal range/gi, '');
          const retiredTerm = [
            /\bcompanions?\b/i,
            /\bprogression\b/i,
            /\brhythm\b/i,
            /\bcadence\b/i,
            /\btarget\b/i,
            /\brange\b/i,
          ].find(pattern => pattern.test(withoutGoalRange));

          return retiredTerm
            ? [
                `${path.relative(
                  path.join(__dirname, '..'),
                  filePath,
                )}: ${fragment.trim()}`,
              ]
            : [];
        }),
      );

    expect(violations).toEqual([]);
  });

  it('normalizes known historical Circle activity copy at read time', () => {
    expect(
      normalizeLegacyMemberCopy(
        'A companion tapped in with two companions.',
        legacyCircleActivityEventTypes.tappedIn,
      ),
    ).toBe('A Member tapped in with two Members.');
    expect(
      normalizeLegacyMemberCopy(
        'A companion tapped in.',
        'tap_in_midday_reminder',
      ),
    ).toBe('A companion tapped in.');
  });

  it('keeps legacy notification wire values behind Circle activity adapters', () => {
    const event: InboxEvent = {
      body: 'A Member tapped in.',
      createdAtLabel: 'Now',
      deeplink: {screen: 'Inbox'},
      feedCategory: legacyCircleActivityFeedCategory,
      id: 'event-1',
      isRead: false,
      title: 'Member Tap In',
      type: legacyCircleActivityEventTypes.tappedIn,
    };

    expect(legacyCircleActivityEventTypes.tappedIn).toBe(
      'companion_tapped_in',
    );
    expect(legacyCircleActivityFeedCategory).toBe('companion');
    expect(isCircleActivityEvent(event, 'viewer-1')).toBe(true);
  });

  it('retains CommitmentCadence as a compatibility alias for Pace', () => {
    const pace: CommitmentPace = 'weekly';
    const legacyPace: CommitmentCadence = pace;

    expect(legacyPace).toBe('weekly');
  });
});
