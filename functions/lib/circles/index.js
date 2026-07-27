"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCircle = exports.updateCircle = exports.convertPersonalCircle = exports.leaveCircle = exports.nudgeCircleMembers = exports.reviewJoinRequest = exports.joinCircle = exports.createCircle = void 0;
const node_crypto_1 = require("node:crypto");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const notifications_1 = require("../notifications");
const commitments_1 = require("../shared/commitments");
const circle_mode_1 = require("../shared/circle-mode");
const invite_code_1 = require("../shared/invite-code");
const thread_1 = require("../thread");
const momentum_1 = require("../momentum");
const leave_plan_1 = require("./leave-plan");
const nudge_targets_1 = require("./nudge-targets");
const graceRuleSchema = zod_1.z.object({
    allowance: zod_1.z.number().int().min(0).max(30),
    windowDays: zod_1.z.number().int().min(1).max(365),
});
const commitmentFrequencySchema = zod_1.z.object({
    opportunitiesPerPeriod: zod_1.z.number().int().min(1).max(31).optional(),
    tapInsPerWeek: zod_1.z.number().int().min(1).max(7),
});
const createCircleSchema = zod_1.z
    .object({
    category: zod_1.z.string().trim().min(1).max(40),
    circleMode: zod_1.z.enum(['personal', 'group']).optional().default('group'),
    commitment: zod_1.z.string().trim().min(1).max(160),
    commitmentCadence: zod_1.z.enum(['daily', 'weekly', 'monthly']).optional(),
    commitmentFrequency: commitmentFrequencySchema,
    commitmentType: zod_1.z.enum(['build', 'limit', 'avoid']).default('build'),
    graceRules: zod_1.z
        .object({
        skip: graceRuleSchema,
    })
        .optional(),
    joinMode: zod_1.z.enum(['open', 'request_to_join', 'invite_only']).optional(),
    maximumValue: zod_1.z.number().int().min(0).max(100000).optional(),
    maxSize: zod_1.z.number().int().min(1).max(100).optional(),
    minimumValue: zod_1.z.number().int().min(0).max(100000).optional(),
    privacy: zod_1.z.enum(['public', 'private']).optional(),
    stepValue: zod_1.z.number().min(0.01).max(100000).default(1),
    targetValue: zod_1.z.number().int().min(0).max(100000).optional(),
    timezone: zod_1.z.string().trim().min(1).max(80).optional(),
    title: zod_1.z.string().trim().min(1).max(80).optional(),
    unitLabel: zod_1.z.string().trim().min(1).max(32).default('Tap In'),
})
    .superRefine((input, context) => {
    if (input.circleMode !== 'group') {
        return;
    }
    if (!input.title) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Circle name is required.',
            path: ['title'],
        });
    }
    if (!input.joinMode) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Join mode is required.',
            path: ['joinMode'],
        });
    }
    if (!input.privacy) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Privacy is required.',
            path: ['privacy'],
        });
    }
    if (!input.maxSize || input.maxSize < 2) {
        context.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'Capacity must be at least 2.',
            path: ['maxSize'],
        });
    }
});
const joinCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    inviteCode: zod_1.z.string().trim().optional(),
});
const reviewJoinRequestSchema = zod_1.z.object({
    approved: zod_1.z.boolean(),
    circleId: zod_1.z.string().trim().min(1),
    requesterId: zod_1.z.string().trim().min(1),
});
const nudgeCircleMembersSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    targetUid: zod_1.z.string().trim().min(1).optional(),
});
const leaveCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
const deleteCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
});
const updateCircleSchema = createCircleSchema.and(zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    idToken: zod_1.z.string().trim().min(1).optional(),
}));
const convertPersonalCircleSchema = zod_1.z.object({
    circleId: zod_1.z.string().trim().min(1),
    joinMode: zod_1.z.enum(['open', 'request_to_join', 'invite_only']),
    maxSize: zod_1.z.number().int().min(2).max(100),
    privacy: zod_1.z.enum(['public', 'private']),
    title: zod_1.z.string().trim().min(1).max(80),
});
async function getAuthenticatedUid(uid, idToken) {
    if (uid) {
        return uid;
    }
    if (!idToken) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
    try {
        const decodedToken = await (0, auth_1.getAuth)().verifyIdToken(idToken);
        return decodedToken.uid;
    }
    catch {
        throw new https_1.HttpsError('unauthenticated', 'Sign in is required.');
    }
}
async function requireCompletedProfile(uid, idToken) {
    const authenticatedUid = await getAuthenticatedUid(uid, idToken);
    const snapshot = await firebase_1.db.collection('users').doc(authenticatedUid).get();
    const profile = snapshot.data();
    if (!profile || profile.onboardingStatus !== 'complete') {
        throw new https_1.HttpsError('failed-precondition', 'Complete your profile first.');
    }
    return { profile, uid: authenticatedUid };
}
function asOptionalString(value) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
}
function getDateKeyForTimezone(timezone, now = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year')?.value ?? '1970';
    const month = parts.find(part => part.type === 'month')?.value ?? '01';
    const day = parts.find(part => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
}
function getCommitmentWeekDateKeys(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
    }).formatToParts(now);
    const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Mon';
    const dayOffsetByWeekday = {
        Fri: 4,
        Mon: 0,
        Sat: 5,
        Sun: 6,
        Thu: 3,
        Tue: 1,
        Wed: 2,
    };
    const localDate = new Date(Number(parts.find(part => part.type === 'year')?.value ?? '1970'), Number(parts.find(part => part.type === 'month')?.value ?? '1') - 1, Number(parts.find(part => part.type === 'day')?.value ?? '1'));
    const monday = new Date(localDate);
    monday.setDate(localDate.getDate() - (dayOffsetByWeekday[weekday] ?? 0));
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return [
            String(date.getFullYear()),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');
    });
}
function getCommitmentMonthDateKeys(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    }).formatToParts(now);
    const year = Number(parts.find(part => part.type === 'year')?.value ?? '1970');
    const month = Number(parts.find(part => part.type === 'month')?.value ?? '1');
    const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: dayCount }, (_, index) => [
        String(year),
        String(month).padStart(2, '0'),
        String(index + 1).padStart(2, '0'),
    ].join('-'));
}
function getCommitmentPeriodDateKeys(cadence, timezone, now = new Date()) {
    if (cadence === 'daily') {
        return [getDateKeyForTimezone(timezone, now)];
    }
    if (cadence === 'monthly') {
        return getCommitmentMonthDateKeys(timezone, now);
    }
    return getCommitmentWeekDateKeys(timezone, now);
}
function buildMemberPublicPreview(profile, uid) {
    return {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName,
        handle: profile.handle,
        uid,
    };
}
function buildPublicPreviewFromMember(member, uid) {
    return {
        avatarUrl: member.avatarUrl ?? null,
        displayName: asOptionalString(member.displayName) ??
            asOptionalString(member.name) ??
            asOptionalString(member.handle) ??
            'Hoyst member',
        handle: asOptionalString(member.handle) ?? null,
        uid,
    };
}
async function deleteCircleServerMetadata(circleId) {
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(circleId);
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const [historySnapshots, memberSnapshots] = await Promise.all([
        circleRef.collection('membershipHistory').get(),
        circleRef.collection('members').get(),
    ]);
    const uids = new Set([...historySnapshots.docs, ...memberSnapshots.docs].map(snapshot => asOptionalString(snapshot.data().uid) ?? snapshot.id));
    const cleanupRefs = [];
    for (const uid of uids) {
        cleanupRefs.push(firebase_1.db
            .collection('userPrivate')
            .doc(uid)
            .collection('pastCircles')
            .doc(circleId));
        const opportunities = await firebase_1.db
            .collection('userPrivate')
            .doc(uid)
            .collection('opportunities')
            .where('circleId', '==', circleId)
            .get();
        cleanupRefs.push(...opportunities.docs.map(snapshot => snapshot.ref));
    }
    for (let index = 0; index < cleanupRefs.length; index += 400) {
        const batch = firebase_1.db.batch();
        cleanupRefs.slice(index, index + 400).forEach(ref => batch.delete(ref));
        await batch.commit();
    }
    await Promise.all([
        publicIndexRef.delete(),
        deleteStoragePrefix(`circles/${circleId}/`),
    ]);
}
function withoutPublicMemberPreview(members, uid) {
    return Array.isArray(members)
        ? members.filter(memberPreview => !(typeof memberPreview === 'object' &&
            memberPreview !== null &&
            'uid' in memberPreview &&
            memberPreview.uid === uid))
        : undefined;
}
async function deleteStoragePrefix(prefix) {
    await (0, storage_1.getStorage)().bucket().deleteFiles({
        force: true,
        prefix,
    });
}
function getHistoricalActivityCopy(checkIn, actorName) {
    const coverageStatus = asOptionalString(checkIn.coverageStatus);
    const status = asOptionalString(checkIn.status);
    if (status === 'skip' || coverageStatus === 'skipped') {
        return { text: `${actorName} used a skip`, tone: 'pending' };
    }
    if (status === 'failed' || coverageStatus === 'failed') {
        return { text: `${actorName} missed the target`, tone: 'alert' };
    }
    if (status === 'partial' || coverageStatus === 'partial') {
        return {
            text: `${actorName} logged partial progress`,
            tone: 'pending',
        };
    }
    return { text: `${actorName} tapped in`, tone: 'success' };
}
function getHistoricalActivityCreatedAt(checkIn, dateKey) {
    if (checkIn.createdAt) {
        return checkIn.createdAt;
    }
    if (checkIn.updatedAt) {
        return checkIn.updatedAt;
    }
    const date = new Date(`${dateKey}T12:00:00.000Z`);
    return Number.isNaN(date.getTime())
        ? firestore_1.FieldValue.serverTimestamp()
        : firestore_1.Timestamp.fromDate(date);
}
async function backfillPersonalCircleActivity({ circleId, owner, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const actorName = asOptionalString(owner.displayName) ??
        asOptionalString(owner.name) ??
        asOptionalString(owner.handle) ??
        'Hoyst member';
    let lastDaySnapshot;
    do {
        let query = circleRef
            .collection('days')
            .orderBy(firestore_1.FieldPath.documentId())
            .limit(350);
        if (lastDaySnapshot) {
            query = query.startAfter(lastDaySnapshot);
        }
        const daySnapshots = await query.get();
        if (daySnapshots.empty) {
            break;
        }
        const checkInSnapshots = await Promise.all(daySnapshots.docs.map(daySnapshot => daySnapshot.ref.collection('checkIns').doc(uid).get()));
        const batch = firebase_1.db.batch();
        checkInSnapshots.forEach((checkInSnapshot, index) => {
            if (!checkInSnapshot.exists) {
                return;
            }
            const checkIn = checkInSnapshot.data() ?? {};
            const dateKey = daySnapshots.docs[index].id;
            const copy = getHistoricalActivityCopy(checkIn, actorName);
            const itemRef = circleRef
                .collection('feedItems')
                .doc(`personal_history_${dateKey}_${uid}`);
            batch.set(itemRef, {
                actor: {
                    avatarUrl: owner.avatarUrl ?? null,
                    displayName: actorName,
                    handle: owner.handle ?? null,
                    uid,
                },
                createdAt: getHistoricalActivityCreatedAt(checkIn, dateKey),
                dateKey,
                historical: true,
                kind: 'activity',
                likeCount: 0,
                likedBy: {},
                mediaImageUrl: checkIn.photoUrl ?? null,
                note: checkIn.note ?? null,
                outcomeStatus: checkIn.coverageStatus ?? checkIn.status ?? 'covered',
                readOnly: true,
                source: 'personal_conversion',
                text: copy.text,
                tone: copy.tone,
                type: 'tap_in',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
        lastDaySnapshot = daySnapshots.docs[daySnapshots.docs.length - 1];
        if (daySnapshots.size < 350) {
            break;
        }
    } while (lastDaySnapshot);
}
async function backfillDepartedMemberActivity({ circleId, uid, }) {
    const circleRef = firebase_1.db.collection('circles').doc(circleId);
    const profileSnapshot = await firebase_1.db.collection('users').doc(uid).get();
    const profile = profileSnapshot.data() ?? {};
    const actorName = asOptionalString(profile.displayName) ??
        asOptionalString(profile.name) ??
        'Former member';
    let lastDaySnapshot;
    do {
        let query = circleRef
            .collection('days')
            .orderBy(firestore_1.FieldPath.documentId())
            .limit(350);
        if (lastDaySnapshot) {
            query = query.startAfter(lastDaySnapshot);
        }
        const daySnapshots = await query.get();
        if (daySnapshots.empty) {
            break;
        }
        const checkInSnapshots = await Promise.all(daySnapshots.docs.map(daySnapshot => daySnapshot.ref.collection('checkIns').doc(uid).get()));
        const batch = firebase_1.db.batch();
        checkInSnapshots.forEach((checkInSnapshot, index) => {
            if (!checkInSnapshot.exists) {
                return;
            }
            const checkIn = checkInSnapshot.data() ?? {};
            const dateKey = daySnapshots.docs[index].id;
            const copy = getHistoricalActivityCopy(checkIn, actorName);
            const isStandardTapIn = checkIn.status === 'done' || checkIn.coverageStatus === 'covered';
            const itemId = isStandardTapIn
                ? `tap_in_${dateKey}_${uid}`
                : `member_history_${dateKey}_${uid}`;
            batch.set(circleRef.collection('feedItems').doc(itemId), {
                actor: {
                    avatarUrl: profile.avatarUrl ?? null,
                    displayName: actorName,
                    handle: profile.handle ?? null,
                    uid,
                },
                createdAt: getHistoricalActivityCreatedAt(checkIn, dateKey),
                dateKey,
                historical: true,
                kind: 'activity',
                mediaImageUrl: checkIn.photoUrl ?? null,
                note: checkIn.note ?? null,
                outcomeStatus: checkIn.coverageStatus ?? checkIn.status ?? 'covered',
                readOnly: true,
                source: 'member_departure',
                text: copy.text,
                tone: copy.tone,
                type: 'tap_in',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await batch.commit();
        lastDaySnapshot = daySnapshots.docs[daySnapshots.docs.length - 1];
    } while (lastDaySnapshot);
}
exports.createCircle = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = createCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc();
    const memberRef = circleRef.collection('members').doc(uid);
    const membershipHistoryRef = circleRef
        .collection('membershipHistory')
        .doc(uid);
    const membershipPeriodRef = membershipHistoryRef
        .collection('periods')
        .doc('initial');
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(circleRef.id);
    const now = firestore_1.FieldValue.serverTimestamp();
    const circleMode = input.circleMode;
    const isPersonal = circleMode === 'personal';
    const inviteCode = isPersonal ? undefined : (0, invite_code_1.createInviteCode)();
    const joinMode = isPersonal ? 'invite_only' : input.joinMode;
    const maxSize = isPersonal ? 1 : input.maxSize;
    const privacy = isPersonal ? 'private' : input.privacy;
    const title = isPersonal ? input.commitment : input.title;
    const commitmentCadence = (0, commitments_1.getInputCommitmentCadence)(input.commitmentCadence, input.commitmentFrequency);
    const commitmentFrequency = (0, commitments_1.getStoredCommitmentFrequency)(commitmentCadence, input.commitmentFrequency);
    const commitmentType = (0, commitments_1.getCommitmentType)(input);
    const quantityConfig = (0, commitments_1.getQuantityConfig)(input);
    const circle = {
        category: input.category,
        circleMode,
        createdAt: now,
        commitment: input.commitment,
        commitmentCadence,
        commitmentFrequency,
        commitmentType,
        graceRules: input.graceRules ?? {
            skip: {
                allowance: 2,
                windowDays: 7,
            },
        },
        ...(inviteCode ? { inviteCode } : {}),
        joinMode,
        ...(typeof quantityConfig.maximumValue === 'number'
            ? { maximumValue: quantityConfig.maximumValue }
            : {}),
        ...(typeof quantityConfig.minimumValue === 'number'
            ? { minimumValue: quantityConfig.minimumValue }
            : {}),
        maxSize,
        memberCount: 1,
        ownerId: uid,
        privacy,
        stepValue: quantityConfig.stepValue,
        ...(typeof quantityConfig.targetValue === 'number'
            ? { targetValue: quantityConfig.targetValue }
            : {}),
        title,
        timezone: input.timezone ?? profile.timezone ?? 'UTC',
        unitLabel: quantityConfig.unitLabel,
        updatedAt: now,
    };
    const batch = firebase_1.db.batch();
    batch.set(circleRef, circle);
    batch.set(memberRef, {
        avatarUrl: profile.avatarUrl ?? null,
        displayName: profile.displayName,
        handle: profile.handle,
        joinedAt: now,
        membershipPeriodId: membershipPeriodRef.id,
        opportunityEligibility: 'include_current',
        role: 'owner',
        status: 'active',
        uid,
    });
    batch.set(membershipHistoryRef, {
        currentPeriodId: membershipPeriodRef.id,
        firstJoinedAt: now,
        lastJoinedAt: now,
        lastRole: 'owner',
        status: 'active',
        uid,
        updatedAt: now,
    });
    batch.set(membershipPeriodRef, {
        circleId: circleRef.id,
        joinedAt: now,
        opportunityEligibility: 'include_current',
        periodId: membershipPeriodRef.id,
        role: 'owner',
        uid,
    });
    if (!isPersonal && privacy === 'public') {
        batch.set(publicIndexRef, {
            category: input.category,
            circleMode,
            commitment: input.commitment,
            commitmentCadence,
            commitmentFrequency,
            commitmentType,
            joinMode,
            ...(typeof quantityConfig.maximumValue === 'number'
                ? { maximumValue: quantityConfig.maximumValue }
                : {}),
            ...(typeof quantityConfig.minimumValue === 'number'
                ? { minimumValue: quantityConfig.minimumValue }
                : {}),
            maxSize,
            memberCount: 1,
            members: [buildMemberPublicPreview(profile, uid)],
            stepValue: quantityConfig.stepValue,
            ...(typeof quantityConfig.targetValue === 'number'
                ? { targetValue: quantityConfig.targetValue }
                : {}),
            title,
            unitLabel: quantityConfig.unitLabel,
            updatedAt: now,
        });
    }
    await batch.commit();
    await (0, momentum_1.materializeCurrentCircleOpportunities)(circleRef.id).catch(error => console.error('materialize_created_circle_opportunities_failed', error));
    if (!isPersonal) {
        await (0, notifications_1.notifyCompanionCircleCreated)({
            actor: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
            circle,
            circleId: circleRef.id,
            circleTitle: title,
            dateKey: getDateKeyForTimezone(circle.timezone),
        }).catch(error => console.error('notify_companion_circle_created_failed', error));
    }
    return {
        circleId: circleRef.id,
        ...(inviteCode ? { inviteCode } : {}),
    };
});
exports.joinCircle = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = joinCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
    const publicIndexRef = firebase_1.db
        .collection('publicCircleIndex')
        .doc(input.circleId);
    const membershipHistoryRef = circleRef
        .collection('membershipHistory')
        .doc(uid);
    const membershipPeriodId = (0, node_crypto_1.randomUUID)();
    const membershipPeriodRef = membershipHistoryRef
        .collection('periods')
        .doc(membershipPeriodId);
    const pastCircleRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('pastCircles')
        .doc(input.circleId);
    const now = firestore_1.FieldValue.serverTimestamp();
    const requestToken = (0, node_crypto_1.randomUUID)();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, joinRequestSnapshot, membershipHistorySnapshot,] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(joinRequestRef),
            transaction.get(membershipHistoryRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        const member = memberSnapshot.data();
        const joinRequest = joinRequestSnapshot.data();
        (0, circle_mode_1.ensureGroupCircle)(circle, 'inviting or joining');
        if (member?.status === 'active') {
            return { shouldNotifyOwner: false, status: 'active' };
        }
        if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0)) {
            throw new https_1.HttpsError('resource-exhausted', 'This circle is full.');
        }
        if ((0, invite_code_1.requiresMatchingCircleInvite)(circle) &&
            input.inviteCode !== circle?.inviteCode) {
            throw new https_1.HttpsError('permission-denied', 'A valid invite is required.');
        }
        if (circle?.joinMode === 'request_to_join') {
            if (member?.status === 'pending' || joinRequest?.status === 'pending') {
                const existingRequestToken = asOptionalString(joinRequest?.notificationToken) ??
                    asOptionalString(member?.notificationToken);
                if (!existingRequestToken && joinRequestSnapshot.exists) {
                    transaction.set(joinRequestRef, { notificationToken: requestToken }, { merge: true });
                    if (memberSnapshot.exists) {
                        transaction.set(memberRef, { notificationToken: requestToken }, { merge: true });
                    }
                    return {
                        requestToken,
                        shouldNotifyOwner: true,
                        status: 'pending',
                    };
                }
                return { shouldNotifyOwner: false, status: 'pending' };
            }
            transaction.set(joinRequestRef, {
                avatarUrl: profile.avatarUrl ?? null,
                createdAt: now,
                displayName: profile.displayName,
                handle: profile.handle,
                notificationToken: requestToken,
                status: 'pending',
                uid,
            }, { merge: true });
            transaction.set(memberRef, {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                notificationToken: requestToken,
                requestedAt: now,
                role: 'member',
                status: 'pending',
                uid,
            }, { merge: true });
            return {
                requestToken,
                shouldNotifyOwner: true,
                status: 'pending',
            };
        }
        const memberPreview = {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            joinedAt: now,
            membershipPeriodId,
            opportunityEligibility: 'next_opening',
            role: 'member',
            status: 'active',
            uid,
        };
        transaction.set(memberRef, memberPreview);
        transaction.set(membershipHistoryRef, {
            currentPeriodId: membershipPeriodId,
            firstJoinedAt: membershipHistorySnapshot.data()?.firstJoinedAt ?? now,
            lastJoinedAt: now,
            lastLeftAt: firestore_1.FieldValue.delete(),
            lastRole: 'member',
            status: 'active',
            uid,
            updatedAt: now,
        }, { merge: true });
        transaction.set(membershipPeriodRef, {
            circleId: input.circleId,
            joinedAt: now,
            opportunityEligibility: 'next_opening',
            periodId: membershipPeriodId,
            role: 'member',
            uid,
        });
        transaction.delete(pastCircleRef);
        transaction.update(circleRef, { memberCount: firestore_1.FieldValue.increment(1) });
        if (circle?.privacy === 'public') {
            transaction.set(publicIndexRef, {
                memberCount: firestore_1.FieldValue.increment(1),
                members: firestore_1.FieldValue.arrayUnion(buildMemberPublicPreview(profile, uid)),
                updatedAt: now,
            }, { merge: true });
        }
        return { shouldNotifyOwner: true, status: 'active' };
    });
    const circleSnapshot = await circleRef.get();
    const circle = circleSnapshot.data();
    const ownerId = asOptionalString(circle?.ownerId);
    const circleTitle = asOptionalString(circle?.title) ?? 'your circle';
    if (result.status === 'active' && result.shouldNotifyOwner) {
        await (0, momentum_1.materializeCurrentCircleOpportunities)(input.circleId).catch(error => console.error('materialize_joined_circle_opportunities_failed', error));
    }
    if (ownerId && result.status === 'pending' && result.shouldNotifyOwner) {
        await (0, notifications_1.notifyOwnerJoinRequest)({
            circleId: input.circleId,
            circleTitle,
            ownerId,
            requestToken: result.requestToken,
            requester: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
        }).catch(error => console.error('notify_owner_join_request_failed', error));
    }
    else if (ownerId &&
        result.status === 'active' &&
        result.shouldNotifyOwner) {
        await (0, notifications_1.notifyOwnerNewJoin)({
            circleId: input.circleId,
            circleTitle,
            joinedMember: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
            ownerId,
        }).catch(error => console.error('notify_owner_new_join_failed', error));
    }
    if (result.status === 'active' && result.shouldNotifyOwner) {
        await (0, notifications_1.notifyCompanionCircleJoined)({
            actor: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
            circle,
            circleId: input.circleId,
            circleTitle,
            dateKey: getDateKeyForTimezone(asOptionalString(circle?.timezone) ?? profile.timezone ?? 'UTC'),
            excludedUids: ownerId ? [ownerId] : undefined,
        }).catch(error => console.error('notify_companion_circle_joined_failed', error));
    }
    return { status: result.status };
});
exports.reviewJoinRequest = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = reviewJoinRequestSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const requesterMemberRef = circleRef
        .collection('members')
        .doc(input.requesterId);
    const joinRequestRef = circleRef
        .collection('joinRequests')
        .doc(input.requesterId);
    const publicIndexRef = firebase_1.db
        .collection('publicCircleIndex')
        .doc(input.circleId);
    const requesterHistoryRef = circleRef
        .collection('membershipHistory')
        .doc(input.requesterId);
    const membershipPeriodId = (0, node_crypto_1.randomUUID)();
    const requesterPeriodRef = requesterHistoryRef
        .collection('periods')
        .doc(membershipPeriodId);
    const requesterPastCircleRef = firebase_1.db
        .collection('userPrivate')
        .doc(input.requesterId)
        .collection('pastCircles')
        .doc(input.circleId);
    const now = firestore_1.FieldValue.serverTimestamp();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, requesterMemberSnapshot, joinRequestSnapshot, requesterHistorySnapshot,] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(requesterMemberRef),
            transaction.get(joinRequestRef),
            transaction.get(requesterHistoryRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        const ownerMember = memberSnapshot.data();
        (0, circle_mode_1.ensureGroupCircle)(circle, 'reviewing join requests');
        if (circle?.ownerId !== uid ||
            ownerMember?.role !== 'owner' ||
            ownerMember?.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Only the circle owner can review requests.');
        }
        const requesterMember = requesterMemberSnapshot.data();
        if (requesterMember?.status !== 'pending' &&
            joinRequestSnapshot.data()?.status !== 'pending') {
            throw new https_1.HttpsError('not-found', 'Join request not found.');
        }
        if ((circle?.memberCount ?? 0) >= (circle?.maxSize ?? 0) &&
            input.approved) {
            throw new https_1.HttpsError('resource-exhausted', 'This circle is full.');
        }
        if (input.approved) {
            const approvedMember = {
                avatarUrl: requesterMember?.avatarUrl ?? null,
                displayName: requesterMember?.displayName ?? 'Hoyst member',
                handle: requesterMember?.handle ?? null,
                joinedAt: now,
                membershipPeriodId,
                opportunityEligibility: 'next_opening',
                role: 'member',
                status: 'active',
                uid: input.requesterId,
            };
            transaction.set(requesterMemberRef, approvedMember, { merge: true });
            transaction.set(requesterHistoryRef, {
                currentPeriodId: membershipPeriodId,
                firstJoinedAt: requesterHistorySnapshot.data()?.firstJoinedAt ?? now,
                lastJoinedAt: now,
                lastLeftAt: firestore_1.FieldValue.delete(),
                lastRole: 'member',
                status: 'active',
                uid: input.requesterId,
                updatedAt: now,
            }, { merge: true });
            transaction.set(requesterPeriodRef, {
                circleId: input.circleId,
                joinedAt: now,
                opportunityEligibility: 'next_opening',
                periodId: membershipPeriodId,
                role: 'member',
                uid: input.requesterId,
            });
            transaction.delete(requesterPastCircleRef);
            transaction.set(joinRequestRef, {
                reviewedAt: now,
                reviewedBy: uid,
                status: 'approved',
            }, { merge: true });
            transaction.update(circleRef, { memberCount: firestore_1.FieldValue.increment(1) });
            if (circle?.privacy === 'public') {
                transaction.set(publicIndexRef, {
                    memberCount: firestore_1.FieldValue.increment(1),
                    members: firestore_1.FieldValue.arrayUnion(buildMemberPublicPreview(approvedMember, input.requesterId)),
                    updatedAt: now,
                }, { merge: true });
            }
        }
        else {
            transaction.delete(requesterMemberRef);
            transaction.set(joinRequestRef, {
                reviewedAt: now,
                reviewedBy: uid,
                status: 'declined',
            }, { merge: true });
        }
        return {
            circleTitle: asOptionalString(circle?.title) ?? 'your circle',
            requesterMember,
            status: input.approved ? 'approved' : 'declined',
        };
    });
    await (0, notifications_1.notifyJoinRequestReview)({
        approved: input.approved,
        circleId: input.circleId,
        circleTitle: result.circleTitle,
        owner: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
        },
        requesterId: input.requesterId,
    }).catch(error => console.error('notify_join_review_failed', error));
    if (input.approved) {
        await (0, momentum_1.materializeCurrentCircleOpportunities)(input.circleId).catch(error => console.error('materialize_approved_circle_opportunities_failed', error));
        const circleSnapshot = await circleRef.get();
        const circle = circleSnapshot.data();
        const ownerId = asOptionalString(circle?.ownerId);
        if (ownerId) {
            await (0, notifications_1.notifyOwnerNewJoin)({
                circleId: input.circleId,
                circleTitle: result.circleTitle,
                joinedMember: result.requesterMember,
                ownerId,
            }).catch(error => console.error('notify_owner_approved_join_failed', error));
            const joinedMember = result.requesterMember ?? {};
            await (0, notifications_1.notifyCompanionCircleJoined)({
                actor: {
                    avatarUrl: joinedMember.avatarUrl ?? null,
                    displayName: asOptionalString(joinedMember.displayName) ?? 'Hoyst member',
                    handle: asOptionalString(joinedMember.handle) ?? null,
                    uid: input.requesterId,
                },
                circle,
                circleId: input.circleId,
                circleTitle: result.circleTitle,
                dateKey: getDateKeyForTimezone(asOptionalString(circle?.timezone) ?? profile.timezone ?? 'UTC'),
                excludedUids: [ownerId],
            }).catch(error => console.error('notify_companion_approved_join_failed', error));
        }
    }
    return { status: result.status };
});
exports.nudgeCircleMembers = (0, https_1.onCall)({ secrets: [notifications_1.oneSignalRestApiKey] }, async (request) => {
    const { profile, uid } = await requireCompletedProfile(request.auth?.uid);
    const input = nudgeCircleMembersSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const now = new Date();
    const [circleSnapshot, memberSnapshot] = await Promise.all([
        circleRef.get(),
        memberRef.get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    const member = memberSnapshot.data();
    if (member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Join this circle first.');
    }
    const circle = circleSnapshot.data();
    (0, circle_mode_1.ensureGroupCircle)(circle, 'sending nudges');
    const timezone = asOptionalString(circle?.timezone) ?? 'UTC';
    const dateKey = getDateKeyForTimezone(timezone, now);
    const commitmentCadence = (0, commitments_1.getCommitmentCadence)(circle);
    const periodDateKeys = getCommitmentPeriodDateKeys(commitmentCadence, timezone, now);
    const requiredTapIns = (0, commitments_1.getRequiredTapIns)(circle);
    const [activeMemberSnapshots, todayCheckInSnapshots, ...periodCheckInSnapshots] = await Promise.all([
        circleRef.collection('members').where('status', '==', 'active').get(),
        circleRef.collection('days').doc(dateKey).collection('checkIns').get(),
        ...periodDateKeys.map(periodDateKey => circleRef
            .collection('days')
            .doc(periodDateKey)
            .collection('checkIns')
            .get()),
    ]);
    const coveredCounts = new Map();
    const todayCoveredUids = new Set();
    todayCheckInSnapshots.docs.forEach(doc => {
        if ((0, commitments_1.isCoveredCheckInData)(doc.data())) {
            todayCoveredUids.add(asOptionalString(doc.data().uid) ?? doc.id);
        }
    });
    const scoringSnapshots = commitmentCadence === 'daily'
        ? [todayCheckInSnapshots]
        : periodCheckInSnapshots;
    scoringSnapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
            if ((0, commitments_1.isCoveredCheckInData)(doc.data())) {
                const targetUid = asOptionalString(doc.data().uid) ?? doc.id;
                coveredCounts.set(targetUid, (coveredCounts.get(targetUid) ?? 0) + 1);
            }
        });
    });
    const targetUids = (0, nudge_targets_1.getNudgeTargetUids)({
        coveredCounts,
        members: activeMemberSnapshots.docs.map(snapshot => ({
            data: snapshot.data(),
            id: snapshot.id,
        })),
        requiredTapIns,
        targetUid: input.targetUid,
        todayCoveredUids,
        viewerUid: uid,
    });
    const targetMembersByUid = new Map(activeMemberSnapshots.docs.map(snapshot => {
        const data = snapshot.data();
        const memberUid = asOptionalString(data.uid) ?? snapshot.id;
        return [memberUid, data];
    }));
    await Promise.all(targetUids.map(targetUid => (0, notifications_1.notifyNudge)({
        actor: {
            avatarUrl: profile.avatarUrl ?? null,
            displayName: profile.displayName,
            handle: profile.handle,
            uid,
        },
        circleId: input.circleId,
        circleTitle: asOptionalString(circle?.title) ?? 'your circle',
        dateKey,
        targetUid,
    })));
    if (targetUids.length > 0) {
        const singleTarget = targetUids.length === 1 ? targetMembersByUid.get(targetUids[0]) : null;
        const targetActor = singleTarget && targetUids[0]
            ? {
                avatarUrl: singleTarget.avatarUrl ?? null,
                displayName: asOptionalString(singleTarget.displayName) ??
                    asOptionalString(singleTarget.name) ??
                    'Hoyst member',
                handle: asOptionalString(singleTarget.handle) ?? null,
                uid: targetUids[0],
            }
            : undefined;
        const targetName = targetActor && targetUids.length === 1
            ? asOptionalString(targetActor.displayName)
            : undefined;
        await (0, thread_1.createCircleThreadActivity)({
            actor: {
                avatarUrl: profile.avatarUrl ?? null,
                displayName: profile.displayName,
                handle: profile.handle,
                uid,
            },
            circleId: input.circleId,
            itemId: `nudge_${dateKey}_${uid}_${input.targetUid ?? 'group'}_${Date.now()}`,
            targetActor,
            text: (0, thread_1.getCircleThreadNudgeText)({
                actorName: profile.displayName ?? 'Someone',
                targetCount: targetUids.length,
                targetName,
            }),
            tone: 'pending',
            type: 'nudge',
        }).catch(error => console.error('create_thread_nudge_activity_failed', error));
    }
    return { nudged: targetUids.length };
});
exports.leaveCircle = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = leaveCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const joinRequestRef = circleRef.collection('joinRequests').doc(uid);
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(input.circleId);
    const membershipHistoryRef = circleRef
        .collection('membershipHistory')
        .doc(uid);
    const pastCircleRef = firebase_1.db
        .collection('userPrivate')
        .doc(uid)
        .collection('pastCircles')
        .doc(input.circleId);
    const leftAtDate = new Date();
    const now = firestore_1.Timestamp.fromDate(leftAtDate);
    const status = await firebase_1.db.runTransaction(async (transaction) => {
        const [circleSnapshot, memberSnapshot, joinRequestSnapshot, publicIndexSnapshot, membershipHistorySnapshot,] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(memberRef),
            transaction.get(joinRequestRef),
            transaction.get(publicIndexRef),
            transaction.get(membershipHistoryRef),
        ]);
        if (!circleSnapshot.exists) {
            throw new https_1.HttpsError('not-found', 'Circle not found.');
        }
        const circle = circleSnapshot.data();
        const member = memberSnapshot.data();
        const joinRequest = joinRequestSnapshot.data();
        const membershipHistory = membershipHistorySnapshot.data();
        if (circle?.ownerId === uid || member?.role === 'owner') {
            throw new https_1.HttpsError('failed-precondition', 'Circle owners cannot leave their own circle yet. Delete the circle instead.');
        }
        const leavePlan = (0, leave_plan_1.getLeaveCirclePlan)({
            activityBackfillStatus: membershipHistory?.activityBackfillStatus,
            historyStatus: membershipHistory?.status,
            joinRequestStatus: joinRequest?.status,
            memberStatus: member?.status,
        });
        const effectiveLeftAt = leavePlan.isDepartureRetry &&
            membershipHistory?.lastLeftAt instanceof firestore_1.Timestamp
            ? membershipHistory.lastLeftAt.toDate()
            : leftAtDate;
        const filteredMembers = withoutPublicMemberPreview(publicIndexSnapshot.data()?.members, uid);
        if (!leavePlan.isActiveMember && !leavePlan.isPendingMember) {
            return { ...leavePlan, leftAt: effectiveLeftAt };
        }
        if (memberSnapshot.exists) {
            transaction.delete(memberRef);
        }
        if (joinRequestSnapshot.exists) {
            transaction.delete(joinRequestRef);
        }
        if (leavePlan.isActiveMember) {
            const membershipPeriodId = asOptionalString(member?.membershipPeriodId) ?? `legacy_${uid}`;
            const membershipPeriodRef = membershipHistoryRef
                .collection('periods')
                .doc(membershipPeriodId);
            transaction.set(membershipHistoryRef, {
                currentPeriodId: firestore_1.FieldValue.delete(),
                activityBackfillStatus: 'pending',
                activityBackfillUpdatedAt: now,
                firstJoinedAt: member?.joinedAt ?? circle?.createdAt ?? now,
                lastJoinedAt: member?.joinedAt ?? circle?.createdAt ?? now,
                lastLeftAt: now,
                lastRole: member?.role ?? 'member',
                status: 'past',
                uid,
                updatedAt: now,
            }, { merge: true });
            transaction.set(membershipPeriodRef, {
                circleId: input.circleId,
                joinedAt: member?.joinedAt ?? circle?.createdAt ?? now,
                leftAt: now,
                opportunityEligibility: member?.opportunityEligibility ?? 'next_opening',
                periodId: membershipPeriodId,
                role: member?.role ?? 'member',
                uid,
            }, { merge: true });
            transaction.set(pastCircleRef, {
                category: circle?.category ?? 'Custom',
                circleId: input.circleId,
                circleMode: (0, circle_mode_1.getCircleMode)(circle),
                commitment: circle?.commitment ?? circle?.title ?? 'Commitment',
                joinedAt: member?.joinedAt ?? circle?.createdAt ?? now,
                leftAt: now,
                privacy: circle?.privacy ?? 'private',
                title: circle?.title ?? 'Past Circle',
                updatedAt: now,
            }, { merge: true });
            transaction.update(circleRef, {
                memberCount: firestore_1.FieldValue.increment(-1),
                updatedAt: now,
            });
        }
        if (publicIndexSnapshot.exists) {
            transaction.set(publicIndexRef, {
                ...(leavePlan.isActiveMember
                    ? { memberCount: firestore_1.FieldValue.increment(-1) }
                    : {}),
                ...(filteredMembers ? { members: filteredMembers } : {}),
                updatedAt: now,
            }, { merge: true });
        }
        return { ...leavePlan, leftAt: effectiveLeftAt };
    });
    if (status.shouldRemoveOpenOpportunities) {
        await (0, momentum_1.removeMemberFromOpenCircleOpportunities)({
            circleId: input.circleId,
            leftAt: status.leftAt,
            uid,
        });
    }
    if (status.shouldBackfillActivity) {
        try {
            await backfillDepartedMemberActivity({ circleId: input.circleId, uid });
            await membershipHistoryRef.set({
                activityBackfillCompletedAt: firestore_1.FieldValue.serverTimestamp(),
                activityBackfillLastFailedAt: firestore_1.FieldValue.delete(),
                activityBackfillStatus: 'complete',
                activityBackfillUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        catch (error) {
            await membershipHistoryRef
                .set({
                activityBackfillLastFailedAt: firestore_1.FieldValue.serverTimestamp(),
                activityBackfillStatus: 'pending',
                activityBackfillUpdatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true })
                .catch(() => undefined);
            throw error;
        }
    }
    return { status: status.status };
});
exports.convertPersonalCircle = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = convertPersonalCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const ownerRef = circleRef.collection('members').doc(uid);
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(input.circleId);
    const [circleSnapshot, ownerSnapshot, activeMemberSnapshots] = await Promise.all([
        circleRef.get(),
        ownerRef.get(),
        circleRef.collection('members').where('status', '==', 'active').get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Personal commitment not found.');
    }
    const circle = circleSnapshot.data();
    const owner = ownerSnapshot.data();
    if (circle?.ownerId !== uid ||
        owner?.role !== 'owner' ||
        owner?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Only the personal commitment owner can convert it.');
    }
    if ((0, circle_mode_1.getCircleMode)(circle) === 'group') {
        if (circle?.convertedFromPersonal === true) {
            const inviteCode = asOptionalString(circle.inviteCode);
            if (inviteCode) {
                return {
                    circleId: input.circleId,
                    inviteCode,
                    inviteUrl: (0, invite_code_1.getCircleInviteUrl)(inviteCode),
                };
            }
        }
        throw new https_1.HttpsError('failed-precondition', 'This commitment is already a Circle.');
    }
    if (activeMemberSnapshots.size !== 1 ||
        activeMemberSnapshots.docs[0]?.id !== uid ||
        circle?.memberCount !== 1) {
        throw new https_1.HttpsError('failed-precondition', 'A personal commitment must have exactly one active owner before conversion.');
    }
    await backfillPersonalCircleActivity({
        circleId: input.circleId,
        owner,
        uid,
    });
    const inviteCode = (0, invite_code_1.createInviteCode)();
    const result = await firebase_1.db.runTransaction(async (transaction) => {
        const [latestCircleSnapshot, latestOwnerSnapshot] = await Promise.all([
            transaction.get(circleRef),
            transaction.get(ownerRef),
        ]);
        const latestCircle = latestCircleSnapshot.data();
        const latestOwner = latestOwnerSnapshot.data();
        if (latestCircle?.ownerId !== uid ||
            latestOwner?.role !== 'owner' ||
            latestOwner?.status !== 'active') {
            throw new https_1.HttpsError('permission-denied', 'Only the personal commitment owner can convert it.');
        }
        if ((0, circle_mode_1.getCircleMode)(latestCircle) === 'group') {
            const existingInviteCode = asOptionalString(latestCircle?.inviteCode);
            if (latestCircle?.convertedFromPersonal && existingInviteCode) {
                return existingInviteCode;
            }
            throw new https_1.HttpsError('failed-precondition', 'This commitment is already a Circle.');
        }
        if (latestCircle?.memberCount !== 1) {
            throw new https_1.HttpsError('failed-precondition', 'The personal commitment membership changed. Try again.');
        }
        const now = firestore_1.FieldValue.serverTimestamp();
        const commitment = asOptionalString(latestCircle?.commitment) ?? input.title;
        const commitmentCadence = (0, commitments_1.getCommitmentCadence)(latestCircle);
        const commitmentFrequency = (0, commitments_1.getStoredCommitmentFrequency)(commitmentCadence, latestCircle?.commitmentFrequency);
        transaction.update(circleRef, {
            circleMode: 'group',
            convertedAt: now,
            convertedFromPersonal: true,
            inviteCode,
            joinMode: input.joinMode,
            maxSize: input.maxSize,
            privacy: input.privacy,
            title: input.title,
            updatedAt: now,
        });
        if (input.privacy === 'public') {
            transaction.set(publicIndexRef, {
                category: latestCircle?.category ?? 'General',
                circleMode: 'group',
                commitment,
                commitmentCadence,
                commitmentFrequency,
                commitmentType: latestCircle?.commitmentType ?? 'build',
                joinMode: input.joinMode,
                ...(typeof latestCircle?.maximumValue === 'number'
                    ? { maximumValue: latestCircle.maximumValue }
                    : {}),
                ...(typeof latestCircle?.minimumValue === 'number'
                    ? { minimumValue: latestCircle.minimumValue }
                    : {}),
                maxSize: input.maxSize,
                memberCount: 1,
                members: [buildPublicPreviewFromMember(latestOwner ?? {}, uid)],
                stepValue: latestCircle?.stepValue ?? 1,
                ...(typeof latestCircle?.targetValue === 'number'
                    ? { targetValue: latestCircle.targetValue }
                    : {}),
                title: input.title,
                unitLabel: latestCircle?.unitLabel ?? 'Tap In',
                updatedAt: now,
            });
        }
        else {
            transaction.delete(publicIndexRef);
        }
        return inviteCode;
    });
    return {
        circleId: input.circleId,
        inviteCode: result,
        inviteUrl: (0, invite_code_1.getCircleInviteUrl)(result),
    };
});
exports.updateCircle = (0, https_1.onCall)(async (request) => {
    const input = updateCircleSchema.parse(request.data);
    const { uid } = await requireCompletedProfile(request.auth?.uid, input.idToken);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const publicIndexRef = firebase_1.db.collection('publicCircleIndex').doc(input.circleId);
    const [circleSnapshot, memberSnapshot, activeMemberSnapshots] = await Promise.all([
        circleRef.get(),
        memberRef.get(),
        circleRef.collection('members').where('status', '==', 'active').get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    const circle = circleSnapshot.data();
    const member = memberSnapshot.data();
    const circleMode = (0, circle_mode_1.getCircleMode)(circle);
    const isPersonal = circleMode === 'personal';
    if (input.circleMode !== circleMode) {
        throw new https_1.HttpsError('failed-precondition', 'Circle mode cannot be changed through editing.');
    }
    if (circle?.ownerId !== uid ||
        member?.role !== 'owner' ||
        member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Only the circle owner can edit this circle.');
    }
    const storedMemberCount = typeof circle?.memberCount === 'number' &&
        Number.isFinite(circle.memberCount)
        ? circle.memberCount
        : 0;
    const memberCount = Math.max(storedMemberCount, activeMemberSnapshots.size);
    const maxSize = isPersonal ? 1 : input.maxSize;
    const title = isPersonal ? input.commitment : input.title;
    const joinMode = isPersonal ? 'invite_only' : input.joinMode;
    const privacy = isPersonal ? 'private' : input.privacy;
    if (maxSize < memberCount) {
        throw new https_1.HttpsError('failed-precondition', 'Max size cannot be below the current member count.');
    }
    const now = firestore_1.FieldValue.serverTimestamp();
    const commitmentCadence = (0, commitments_1.getInputCommitmentCadence)(input.commitmentCadence, input.commitmentFrequency);
    const commitmentFrequency = (0, commitments_1.getStoredCommitmentFrequency)(commitmentCadence, input.commitmentFrequency);
    const commitmentType = (0, commitments_1.getCommitmentType)(input);
    const quantityConfig = (0, commitments_1.getQuantityConfig)(input);
    const circleUpdate = {
        category: input.category,
        circleMode,
        commitment: input.commitment,
        commitmentCadence,
        commitmentFrequency,
        commitmentType,
        graceRules: input.graceRules ?? {
            skip: {
                allowance: 2,
                windowDays: 7,
            },
        },
        joinMode,
        maximumValue: typeof quantityConfig.maximumValue === 'number'
            ? quantityConfig.maximumValue
            : firestore_1.FieldValue.delete(),
        maxSize,
        minimumValue: typeof quantityConfig.minimumValue === 'number'
            ? quantityConfig.minimumValue
            : firestore_1.FieldValue.delete(),
        privacy,
        stepValue: quantityConfig.stepValue,
        targetValue: typeof quantityConfig.targetValue === 'number'
            ? quantityConfig.targetValue
            : firestore_1.FieldValue.delete(),
        title,
        timezone: input.timezone ?? circle?.timezone ?? 'UTC',
        unitLabel: quantityConfig.unitLabel,
        updatedAt: now,
    };
    const batch = firebase_1.db.batch();
    batch.update(circleRef, circleUpdate);
    if (!isPersonal && privacy === 'public') {
        batch.set(publicIndexRef, {
            category: input.category,
            circleMode,
            commitment: input.commitment,
            commitmentCadence,
            commitmentFrequency,
            commitmentType,
            joinMode,
            maximumValue: typeof quantityConfig.maximumValue === 'number'
                ? quantityConfig.maximumValue
                : firestore_1.FieldValue.delete(),
            maxSize,
            memberCount,
            members: activeMemberSnapshots.docs.map(snapshot => buildPublicPreviewFromMember(snapshot.data(), snapshot.id)),
            minimumValue: typeof quantityConfig.minimumValue === 'number'
                ? quantityConfig.minimumValue
                : firestore_1.FieldValue.delete(),
            stepValue: quantityConfig.stepValue,
            targetValue: typeof quantityConfig.targetValue === 'number'
                ? quantityConfig.targetValue
                : firestore_1.FieldValue.delete(),
            title,
            unitLabel: quantityConfig.unitLabel,
            updatedAt: now,
        }, { merge: true });
    }
    else {
        batch.delete(publicIndexRef);
    }
    await batch.commit();
    return { updated: true };
});
exports.deleteCircle = (0, https_1.onCall)(async (request) => {
    const { uid } = await requireCompletedProfile(request.auth?.uid);
    const input = deleteCircleSchema.parse(request.data);
    const circleRef = firebase_1.db.collection('circles').doc(input.circleId);
    const memberRef = circleRef.collection('members').doc(uid);
    const [circleSnapshot, memberSnapshot] = await Promise.all([
        circleRef.get(),
        memberRef.get(),
    ]);
    if (!circleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'Circle not found.');
    }
    const circle = circleSnapshot.data();
    const member = memberSnapshot.data();
    if (circle?.ownerId !== uid ||
        member?.role !== 'owner' ||
        member?.status !== 'active') {
        throw new https_1.HttpsError('permission-denied', 'Only the circle owner can delete this circle.');
    }
    await deleteCircleServerMetadata(input.circleId);
    await firebase_1.db.recursiveDelete(circleRef);
    return { deleted: true };
});
