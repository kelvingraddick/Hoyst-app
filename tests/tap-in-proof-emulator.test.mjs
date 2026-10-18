import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {before, after, beforeEach, describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {ref, uploadBytes, deleteObject, getDownloadURL} from 'firebase/storage';

const require = createRequire(import.meta.url);
const functionsRoot =
  process.env.HOYST_PROOF_FUNCTIONS_ROOT ??
  new URL('../functions/', import.meta.url).pathname;
const admin = require(`${functionsRoot}/node_modules/firebase-admin`);
const projectId = 'demo-hoyst-proof';
const bucketName = `${projectId}.appspot.com`;
const uid = 'proof-owner';
let environment,
  db,
  bucket,
  submitTapIn,
  updateTapInDetails,
  createCircle,
  updateCircle,
  removeTapIn,
  completeProfile,
  convertPersonalCircle,
  archiveCircle,
  unarchiveCircle;
const today = () => new Date().toISOString().slice(0, 10);
const checkIn = id => db.doc(`circles/${id}/days/${today()}/checkIns/${uid}`);
const call = (fn, data, user = uid) =>
  fn.run({auth: {uid: user, token: {}}, data});
const circlePayload = {
  category: 'Fitness',
  circleMode: 'group',
  title: 'Proof Circle',
  commitment: 'Walk',
  commitmentCadence: 'daily',
  commitmentFrequency: {tapInsPerWeek: 7},
  commitmentType: 'build',
  buildTrackingMode: 'confirmation',
  maxSize: 10,
  joinMode: 'open',
  privacy: 'public',
  timezone: 'UTC',
  unitLabel: 'Tap In',
  graceRules: {skip: {allowance: 2, windowDays: 7}},
};
async function seed(id = 'proof-circle', extra = {}) {
  const joinedAt = admin.firestore.Timestamp.fromMillis(
    Date.now() - 3 * 86400000,
  );
  await db.doc(`circles/${id}`).set({
    ...circlePayload,
    ownerId: uid,
    memberCount: 1,
    createdAt: joinedAt,
    lifecycleStatus: 'active',
    proofRequirement: 'photo',
    ...extra,
  });
  await db.doc(`circles/${id}/members/${uid}`).set({
    uid,
    role: 'owner',
    status: 'active',
    joinedAt,
    opportunityEligibility: 'include_current',
  });
  await db
    .doc(`circles/${id}/membershipHistory/${uid}/periods/initial`)
    .set({uid, joinedAt, opportunityEligibility: 'include_current'});
  return id;
}
async function photo(
  id,
  {
    user = uid,
    date = today(),
    name = 'proof-one.jpg',
    contentType = 'image/jpeg',
    upload = true,
  } = {},
) {
  const path = `circles/${id}/check-ins/${date}/${user}/${name}`;
  if (upload)
    await bucket.file(path).save(Buffer.from([255, 216, 255, 217]), {
      metadata: {
        contentType,
        metadata: {firebaseStorageDownloadTokens: 'fixture'},
      },
    });
  return `http://${
    process.env.FIREBASE_STORAGE_EMULATOR_HOST
  }/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=fixture`;
}

describe('Tap In proof server and Storage enforcement', () => {
  before(async () => {
    assert.ok(
      process.env.FIRESTORE_EMULATOR_HOST,
      'Firestore emulator required',
    );
    assert.ok(
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
      'Storage emulator required',
    );
    admin.initializeApp({projectId, storageBucket: bucketName});
    db = admin.firestore();
    bucket = admin.storage().bucket();
    ({
      submitTapIn,
      updateTapInDetails,
      removeTapIn,
    } = require(`${functionsRoot}/lib/checkins`));
    ({
      createCircle,
      updateCircle,
      convertPersonalCircle,
      archiveCircle,
      unarchiveCircle,
    } = require(`${functionsRoot}/lib/circles`));
    ({completeProfile} = require(`${functionsRoot}/lib/auth`));
    environment = await initializeTestEnvironment({
      projectId,
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
    });
  });
  after(async () => {
    await environment?.cleanup();
    await admin.app().delete();
  });
  beforeEach(async () => {
    await environment.clearFirestore();
    await bucket.deleteFiles({force: true});
    await db.doc(`users/${uid}`).set({
      onboardingStatus: 'complete',
      displayName: 'Proof owner',
      handle: 'proof_owner',
      timezone: 'UTC',
    });
    await db.doc('serverConfig/progress').set({earningEnabled: true});
    await db
      .doc(`userPrivate/${uid}`)
      .set({
        legalAcceptance: {
          adult: true,
          termsVersion: '2026-10-17',
          privacyVersion: '2026-10-17',
          acceptedAt: admin.firestore.Timestamp.now(),
        },
      });
  });
  it('defaults group and personal creation to photo and permits an explicit none', async () => {
    for (const circleMode of ['group', 'personal']) {
      const result = await call(createCircle, {...circlePayload, circleMode});
      assert.equal(
        (await db.doc(`circles/${result.circleId}`).get()).data()
          .proofRequirement,
        'photo',
      );
    }
    const result = await call(createCircle, {
      ...circlePayload,
      proofRequirement: 'none',
    });
    assert.equal(
      (await db.doc(`circles/${result.circleId}`).get()).data()
        .proofRequirement,
      'none',
    );
  });
  it('preserves a stored rule when older edit requests omit it and checks ownership', async () => {
    const id = await seed();
    await call(updateCircle, {...circlePayload, circleId: id});
    assert.equal(
      (await db.doc(`circles/${id}`).get()).data().proofRequirement,
      'photo',
    );
    await call(updateCircle, {
      ...circlePayload,
      circleId: id,
      proofRequirement: 'none',
    });
    assert.equal(
      (await db.doc(`circles/${id}`).get()).data().proofRequirement,
      'none',
    );
    await db
      .doc('users/other')
      .set({onboardingStatus: 'complete', timezone: 'UTC'});
    await assert.rejects(
      call(
        updateCircle,
        {...circlePayload, circleId: id, proofRequirement: 'photo'},
        'other',
      ),
      /Only the circle owner/,
    );
  });
  it('rejects missing proof without creating a completion, XP, or completed Opportunity', async () => {
    const id = await seed();
    await assert.rejects(call(submitTapIn, {circleId: id}), /Add Photo proof/);
    assert.equal((await checkIn(id).get()).exists, false);
    assert.equal(
      (await db.collection(`userPrivate/${uid}/progressLedger`).get()).size,
      0,
    );
    const opportunities = await db
      .collection(`userPrivate/${uid}/opportunities`)
      .get();
    assert.equal(
      opportunities.docs.some(doc => doc.data().status === 'completed'),
      false,
    );
  });
  it('accepts uploaded proof and rejects removal while allowing replacement', async () => {
    const id = await seed();
    const first = await photo(id);
    const result = await call(submitTapIn, {circleId: id, photoUrl: first});
    assert.equal(result.status, 'done');
    assert.equal(result.photoUrl, first);
    assert.equal((await checkIn(id).get()).data().proofRequirement, 'photo');
    await assert.rejects(
      call(updateTapInDetails, {circleId: id, note: null, photoUrl: null}),
      /Add Photo proof/,
    );
    const replacement = await photo(id, {name: 'proof-replacement.jpg'});
    await call(updateTapInDetails, {
      circleId: id,
      note: 'Replaced',
      photoUrl: replacement,
    });
    assert.equal((await checkIn(id).get()).data().photoUrl, replacement);
    assert.equal(
      (
        await bucket
          .file(`circles/${id}/check-ins/${today()}/${uid}/proof-one.jpg`)
          .exists()
      )[0],
      true,
    );
  });
  it('exempts partial/failed progress and Skips, but requires proof when progress completes', async () => {
    for (const commitmentType of ['build', 'limit']) {
      const id = await seed(`quantity-${commitmentType}`, {
        commitmentType,
        buildTrackingMode: 'quantity',
        targetValue: 10,
        minimumValue: 5,
        maximumValue: 10,
      });
      const incomplete = await call(submitTapIn, {
        circleId: id,
        currentValue: commitmentType === 'build' ? 4 : 12,
      });
      assert.equal(
        incomplete.status,
        commitmentType === 'build' ? 'partial' : 'failed',
      );
      await assert.rejects(
        call(submitTapIn, {circleId: id, currentValue: 10}),
        /Add Photo proof/,
      );
      const url = await photo(id);
      await call(submitTapIn, {circleId: id, currentValue: 10, photoUrl: url});
      await call(submitTapIn, {
        circleId: id,
        currentValue: commitmentType === 'build' ? 12 : 9,
      });
      assert.equal((await checkIn(id).get()).data().photoUrl, url);
    }
    const id = await seed('skip-circle');
    const skipped = await call(submitTapIn, {circleId: id, status: 'skip'});
    assert.equal(skipped.status, 'skip');
  });
  it('requires a photo for successful Avoid entries', async () => {
    const id = await seed('avoid-circle', {commitmentType: 'avoid'});
    await assert.rejects(call(submitTapIn, {circleId: id}), /Add Photo proof/);
    assert.equal(
      (await call(submitTapIn, {circleId: id, photoUrl: await photo(id)}))
        .status,
      'done',
    );
  });
  it('keeps existing partial proof snapshots after the Circle policy changes in either direction', async () => {
    for (const original of ['photo', 'none']) {
      const id = await seed(`snapshot-${original}`, {
        proofRequirement: original,
        buildTrackingMode: 'quantity',
        targetValue: 10,
      });
      await call(submitTapIn, {circleId: id, currentValue: 3});
      await db
        .doc(`circles/${id}`)
        .update({proofRequirement: original === 'photo' ? 'none' : 'photo'});
      if (original === 'photo')
        await assert.rejects(
          call(submitTapIn, {circleId: id, currentValue: 10}),
          /Add Photo proof/,
        );
      else
        assert.equal(
          (await call(submitTapIn, {circleId: id, currentValue: 10})).status,
          'done',
        );
    }
  });
  it('keeps legacy Circles and legacy entries free of new proof requirements', async () => {
    const id = await seed('legacy-circle');
    await db
      .doc(`circles/${id}`)
      .update({proofRequirement: admin.firestore.FieldValue.delete()});
    assert.equal((await call(submitTapIn, {circleId: id})).status, 'done');
    const other = await seed('legacy-partial', {
      buildTrackingMode: 'quantity',
      targetValue: 10,
    });
    await checkIn(other).set({
      uid,
      status: 'partial',
      coverageStatus: 'partial',
      currentValue: 3,
    });
    assert.equal(
      (await call(submitTapIn, {circleId: other, currentValue: 10})).status,
      'done',
    );
  });
  it('permits optional attachments and removal under none', async () => {
    const id = await seed('optional-circle', {proofRequirement: 'none'});
    await call(submitTapIn, {circleId: id});
    await call(updateTapInDetails, {
      circleId: id,
      note: 'Optional',
      photoUrl: await photo(id),
    });
    await call(updateTapInDetails, {circleId: id, note: null, photoUrl: null});
    assert.equal((await checkIn(id).get()).data().status, 'done');
  });
  it('uses the current proof rule after removing and recreating a Tap In', async () => {
    const id = await seed('recreate-circle', {proofRequirement: 'none'});
    await call(submitTapIn, {circleId: id});
    await db.doc(`circles/${id}`).update({proofRequirement: 'photo'});
    await call(removeTapIn, {circleId: id});
    await assert.rejects(call(submitTapIn, {circleId: id}), /Add Photo proof/);
  });
  it('rejects wrong-member, wrong-date, missing, non-image, and arbitrary proof URLs', async () => {
    const id = await seed();
    for (const photoUrl of [
      await photo(id, {user: 'other'}),
      await photo(id, {date: '2000-01-01'}),
      await photo(id, {name: 'proof-missing.jpg', upload: false}),
      await photo(id, {name: 'proof-text.jpg', contentType: 'text/plain'}),
      (await photo(id, {name: 'proof-invalidtoken.jpg'})).replace('token=fixture', 'token=wrong'),
      'https://example.com/image.jpg',
    ]) {
      await assert.rejects(
        call(submitTapIn, {circleId: id, photoUrl}),
        /photo|Photo/,
      );
      assert.equal((await checkIn(id).get()).exists, false);
    }
  });
  it('allows authenticated image creation, denies overwrites, deletion, and foreign uploads', async () => {
    const id = await seed();
    const storage = environment.authenticatedContext(uid).storage(bucketName);
    const path = `circles/${id}/check-ins/${today()}/${uid}/proof-client.jpg`;
    const object = ref(storage, path);
    const bytes = new Uint8Array([255, 216, 255, 217]);
    await assertSucceeds(
      uploadBytes(object, bytes, {contentType: 'image/jpeg'}),
    );
    await assertFails(uploadBytes(object, bytes, {contentType: 'image/jpeg'}));
    await assertFails(deleteObject(object));
    await assertFails(
      uploadBytes(ref(storage, path.replace(uid, 'other')), bytes, {
        contentType: 'image/jpeg',
      }),
    );
    await assertFails(
      uploadBytes(
        ref(storage, path.replace('proof-client', 'proof-text')),
        bytes,
        {contentType: 'text/plain'},
      ),
    );
  });
  it('honors the proof choice in onboarding and reuses a saved setup result', async () => {
    for (const proofRequirement of ['photo', 'none']) {
      const data = {
        displayName: 'Proof owner',
        handle: 'proof_owner',
        timezone: 'UTC',
        starterCircle: {
          ...circlePayload,
          proofRequirement,
          setupId: `proof-setup-${proofRequirement}`,
        },
      };
      const first = await call(completeProfile, data);
      const second = await call(completeProfile, data);
      assert.equal(first.starterCircle.circleId, second.starterCircle.circleId);
      assert.equal(
        (await db.doc(`circles/${first.starterCircle.circleId}`).get()).data()
          .proofRequirement,
        proofRequirement,
      );
    }
  });
  it('preserves the proof setting through conversion, archive, and unarchive', async () => {
    const id = await seed('convert-circle', {
      circleMode: 'personal',
      maxSize: 1,
      privacy: 'private',
      joinMode: 'invite_only',
    });
    await call(convertPersonalCircle, {
      circleId: id,
      title: 'Now shared',
      maxSize: 10,
      privacy: 'public',
      joinMode: 'open',
    });
    assert.equal(
      (await db.doc(`circles/${id}`).get()).data().proofRequirement,
      'photo',
    );
    assert.equal(
      (await db.doc(`publicCircleIndex/${id}`).get()).data().proofRequirement,
      'photo',
    );
    await call(archiveCircle, {circleId: id});
    await call(unarchiveCircle, {circleId: id});
    assert.equal(
      (await db.doc(`circles/${id}`).get()).data().proofRequirement,
      'photo',
    );
    assert.equal(
      (await db.doc(`publicCircleIndex/${id}`).get()).data().proofRequirement,
      'photo',
    );
  });
  it('accepts a real Firebase client upload and its generated download token', async () => {
    const id = await seed('client-upload-circle');
    const storage = environment.authenticatedContext(uid).storage(bucketName);
    const object = ref(storage, `circles/${id}/check-ins/${today()}/${uid}/proof-sdk.jpg`);
    await uploadBytes(object, new Uint8Array([255, 216, 255, 217]), {contentType: 'image/jpeg'});
    const photoUrl = await getDownloadURL(object);
    const result = await call(submitTapIn, {circleId: id, photoUrl});
    assert.equal(result.status, 'done');
    assert.equal((await checkIn(id).get()).data().photoUrl, photoUrl);
  });

});
