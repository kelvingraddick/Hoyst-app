import {renderInvitePage as renderPage} from './page';
import {websiteHeaders} from '../website/page';
import {HttpsError, onCall, onRequest} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';
import {z} from 'zod';

import {db} from '../firebase';
import {ensureActiveCircle} from '../shared/circle-lifecycle';
import {
  buildCircleInvitePreview,
  createInviteCode,
  getCircleInviteUrl,
  normalizeInviteCode,
} from '../shared/invite-code';

const resolveInviteSchema = z.object({
  inviteCode: z.string().trim(),
});
const rotateInviteSchema = z.object({
  circleId: z.string().trim().min(1),
});
async function findCircleInvite(inviteCode: string) {
  const snapshots = await db
    .collection('circles')
    .where('inviteCode', '==', inviteCode)
    .limit(2)
    .get();

  if (snapshots.size !== 1) {
    if (snapshots.size > 1) {
      console.error('circle_invite_lookup_ambiguous', {
        matchingCircleCount: snapshots.size,
      });
    }
    return undefined;
  }

  const snapshot = snapshots.docs[0];
  return buildCircleInvitePreview(snapshot.id, snapshot.data());
}

async function createUniqueInviteCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = createInviteCode();
    const existing = await db
      .collection('circles')
      .where('inviteCode', '==', inviteCode)
      .limit(1)
      .get();

    if (existing.empty) {
      return inviteCode;
    }
  }

  throw new HttpsError(
    'internal',
    'Could not create a unique invite link. Try again.',
  );
}

function parseInviteCodeFromPath(path: string) {
  const match = path.match(/(?:^|\/)join\/([^/?#]+)/i);

  if (!match?.[1]) {
    return undefined;
  }

  try {
    return normalizeInviteCode(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}

function renderUnavailablePage() {
  return renderPage({
    description:
      'This Circle invitation is no longer available. Ask the Circle owner for a new link.',
    statusCode: 404,
    title: 'Invite no longer available',
  });
}

export const resolveCircleInvite = onCall(async request => {
  const input = resolveInviteSchema.parse(request.data);
  const inviteCode = normalizeInviteCode(input.inviteCode);

  if (!inviteCode) {
    throw new HttpsError('not-found', 'Invite no longer available.');
  }

  const preview = await findCircleInvite(inviteCode);

  if (!preview) {
    throw new HttpsError('not-found', 'Invite no longer available.');
  }

  if (request.auth?.uid) {
    const membership = await db
      .collection('circles')
      .doc(preview.circleId)
      .collection('members')
      .doc(request.auth.uid)
      .get();
    const status = membership.data()?.status;
    return {
      ...preview,
      viewerUid: request.auth.uid,
      ...(status === 'active' || status === 'pending'
        ? {viewerMembershipStatus: status}
        : {}),
    };
  }
  return preview;
});

export const rotateCircleInvite = onCall(async request => {
  const uid = request.auth?.uid;

  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in is required.');
  }

  const input = rotateInviteSchema.parse(request.data);
  const inviteCode = await createUniqueInviteCode();
  const circleRef = db.collection('circles').doc(input.circleId);
  const memberRef = circleRef.collection('members').doc(uid);

  await db.runTransaction(async transaction => {
    const [circleSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(circleRef),
      transaction.get(memberRef),
    ]);
    const circle = circleSnapshot.data();
    const member = memberSnapshot.data();

    if (!circleSnapshot.exists || !circle || circle.circleMode === 'personal') {
      throw new HttpsError('not-found', 'Circle not found.');
    }

    ensureActiveCircle(circle, 'resetting its invite link');

    if (
      circle.ownerId !== uid ||
      member?.role !== 'owner' ||
      member.status !== 'active'
    ) {
      throw new HttpsError(
        'permission-denied',
        'Only the Circle owner can reset its invite link.',
      );
    }

    transaction.update(circleRef, {
      inviteCode,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    inviteCode,
    inviteUrl: getCircleInviteUrl(inviteCode),
  };
});

export const invitePage = onRequest(async (request, response) => {
  response.set(websiteHeaders);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.status(405).send(renderUnavailablePage());
    return;
  }

  const inviteCode = parseInviteCodeFromPath(request.path);

  if (!inviteCode) {
    response.status(404).send(renderUnavailablePage());
    return;
  }

  const preview = await findCircleInvite(inviteCode);

  if (!preview) {
    response.status(404).send(renderUnavailablePage());
    return;
  }

  response.status(200).send(
    renderPage({
      description: `${preview.commitment} · ${preview.cadenceLabel}`,
      inviteCode,
      preview,
      statusCode: 200,
      title: `Join ${preview.title} on Hoyst`,
    }),
  );
});
