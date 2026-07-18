import {readFileSync} from 'node:fs';
import {after, before, beforeEach, describe, it} from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
import {getBytes, ref as storageRef, uploadBytes} from 'firebase/storage';

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
      storage: {
        rules: readFileSync(
          new URL('../storage.rules', import.meta.url),
          'utf8',
        ),
      },
      projectId: 'hoyst-firebase-app',
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
        setDoc(doc(firestore, 'circles/past-private'), {
          circleMode: 'group',
          privacy: 'private',
          title: 'Past private circle',
        }),
        setDoc(doc(firestore, 'circles/past-private/members/current-1'), {
          status: 'active',
          uid: 'current-1',
        }),
        setDoc(
          doc(firestore, 'circles/past-private/membershipHistory/former-1'),
          {status: 'past', uid: 'former-1'},
        ),
        setDoc(
          doc(
            firestore,
            'circles/past-private/membershipHistory/former-1/periods/period-1',
          ),
          {circleId: 'past-private', uid: 'former-1'},
        ),
        setDoc(doc(firestore, 'circles/past-private/days/2026-07-01'), {
          checkInCount: 2,
        }),
        setDoc(
          doc(
            firestore,
            'circles/past-private/days/2026-07-01/checkIns/former-1',
          ),
          {circleId: 'past-private', status: 'done', uid: 'former-1'},
        ),
        setDoc(
          doc(
            firestore,
            'circles/past-private/days/2026-07-01/checkIns/current-1',
          ),
          {circleId: 'past-private', status: 'done', uid: 'current-1'},
        ),
        setDoc(doc(firestore, 'circles/past-private/feedItems/activity-1'), {
          text: 'Private activity',
        }),
        setDoc(
          doc(firestore, 'circles/past-private/opportunities/2026-07-01'),
          {coveredOpportunityCount: 1},
        ),
        setDoc(
          doc(firestore, 'userPrivate/former-1/pastCircles/past-private'),
          {
            circleId: 'past-private',
            title: 'Past private circle',
          },
        ),
      ]);

      await Promise.all([
        uploadBytes(
          storageRef(
            context.storage(),
            'circles/past-private/check-ins/2026-07-01/former-1/photo.jpg',
          ),
          new Uint8Array([1, 2, 3]),
        ),
        uploadBytes(
          storageRef(
            context.storage(),
            'circles/past-private/check-ins/2026-07-01/current-1/photo.jpg',
          ),
          new Uint8Array([4, 5, 6]),
        ),
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

  it('limits former members to their private Past Circle history', async () => {
    const firestore = testEnvironment
      .authenticatedContext('former-1')
      .firestore();

    await assertSucceeds(
      getDoc(doc(firestore, 'userPrivate/former-1/pastCircles/past-private')),
    );
    await assertSucceeds(
      getDoc(doc(firestore, 'circles/past-private/membershipHistory/former-1')),
    );
    await assertSucceeds(
      getDoc(
        doc(
          firestore,
          'circles/past-private/membershipHistory/former-1/periods/period-1',
        ),
      ),
    );
    await assertSucceeds(
      getDoc(
        doc(
          firestore,
          'circles/past-private/days/2026-07-01/checkIns/former-1',
        ),
      ),
    );
    await assertFails(getDoc(doc(firestore, 'circles/past-private')));
    await assertFails(
      getDoc(
        doc(
          firestore,
          'circles/past-private/days/2026-07-01/checkIns/current-1',
        ),
      ),
    );
    await assertFails(
      getDoc(doc(firestore, 'circles/past-private/feedItems/activity-1')),
    );
    await assertFails(
      getDoc(doc(firestore, 'circles/past-private/opportunities/2026-07-01')),
    );
  });

  it('lets a former member read their own retained media only', async () => {
    const formerStorage = testEnvironment
      .authenticatedContext('former-1')
      .storage();
    const formerPhotoPath =
      'circles/past-private/check-ins/2026-07-01/former-1/photo.jpg';
    const currentPhotoPath =
      'circles/past-private/check-ins/2026-07-01/current-1/photo.jpg';

    await assertSucceeds(getBytes(storageRef(formerStorage, formerPhotoPath)));
    await assertFails(getBytes(storageRef(formerStorage, currentPhotoPath)));
  });

  it('lets remaining active members read retained former-member media', async () => {
    const activeStorage = testEnvironment
      .authenticatedContext('current-1')
      .storage();
    const formerPhotoPath =
      'circles/past-private/check-ins/2026-07-01/former-1/photo.jpg';

    await assertSucceeds(getBytes(storageRef(activeStorage, formerPhotoPath)));
  });
});
