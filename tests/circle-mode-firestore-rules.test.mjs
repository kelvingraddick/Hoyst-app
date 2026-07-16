import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';

describe('circle mode Firestore rules', () => {
  let testEnvironment;

  before(async () => {
    testEnvironment = await initializeTestEnvironment({
      firestore: {
        rules: readFileSync(
          new URL('../firestore.rules', import.meta.url),
          'utf8',
        ),
      },
      projectId: 'hoyst-circle-mode-rules',
    });
  });

  after(async () => {
    await testEnvironment.cleanup();
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
    await testEnvironment.withSecurityRulesDisabled(async context => {
      const firestore = context.firestore();

      await Promise.all([
        setDoc(doc(firestore, 'circles/legacy-group'), {
          privacy: 'public',
          title: 'Legacy group',
        }),
        setDoc(doc(firestore, 'circles/legacy-group/members/user-1'), {
          status: 'active',
          uid: 'user-1',
        }),
        setDoc(doc(firestore, 'circles/legacy-group/feedItems/activity-1'), {
          text: 'Group activity',
        }),
        setDoc(doc(firestore, 'circles/legacy-group/threadReads/user-1'), {
          readAt: new Date(),
        }),
        setDoc(doc(firestore, 'circles/personal'), {
          circleMode: 'personal',
          privacy: 'public',
          title: 'Read every day',
        }),
        setDoc(doc(firestore, 'circles/personal/members/user-1'), {
          status: 'active',
          uid: 'user-1',
        }),
        setDoc(doc(firestore, 'circles/personal/days/2026-07-15'), {
          checkInCount: 1,
        }),
        setDoc(
          doc(firestore, 'circles/personal/days/2026-07-15/checkIns/user-1'),
          {status: 'done', uid: 'user-1'},
        ),
        setDoc(doc(firestore, 'circles/personal/feedItems/activity-1'), {
          readOnly: true,
          text: 'Hidden personal activity',
        }),
        setDoc(doc(firestore, 'circles/personal/threadReads/user-1'), {
          readAt: new Date(),
        }),
        setDoc(doc(firestore, 'publicCircleIndex/legacy-group'), {
          title: 'Legacy group',
        }),
        setDoc(doc(firestore, 'publicCircleIndex/personal'), {
          circleMode: 'personal',
          title: 'Read every day',
        }),
      ]);
    });
  });

  it('keeps missing circleMode compatible while hiding personal discovery', async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(firestore, 'circles/legacy-group')));
    await assertSucceeds(
      getDoc(doc(firestore, 'publicCircleIndex/legacy-group')),
    );
    await assertFails(getDoc(doc(firestore, 'circles/personal')));
    await assertFails(getDoc(doc(firestore, 'publicCircleIndex/personal')));
  });

  it('keeps personal Tap Ins readable to the owner but blocks social data', async () => {
    const firestore = testEnvironment
      .authenticatedContext('user-1')
      .firestore();

    await assertSucceeds(getDoc(doc(firestore, 'circles/personal')));
    await assertSucceeds(
      getDoc(
        doc(firestore, 'circles/personal/days/2026-07-15/checkIns/user-1'),
      ),
    );
    await assertFails(
      getDoc(doc(firestore, 'circles/personal/feedItems/activity-1')),
    );
    await assertFails(
      getDoc(doc(firestore, 'circles/personal/threadReads/user-1')),
    );
  });

  it('reveals activity and thread state when the circle is group mode', async () => {
    const firestore = testEnvironment
      .authenticatedContext('user-1')
      .firestore();

    await assertSucceeds(
      getDoc(doc(firestore, 'circles/legacy-group/feedItems/activity-1')),
    );
    await assertSucceeds(
      getDoc(doc(firestore, 'circles/legacy-group/threadReads/user-1')),
    );
  });
});
