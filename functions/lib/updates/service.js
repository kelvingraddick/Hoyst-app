"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenDigest = exports.UpdatesError = exports.CONSENT_TEXT = exports.CONSENT_VERSION = void 0;
exports.requestUpdates = requestUpdates;
exports.subscribeUpdates = subscribeUpdates;
exports.confirmUpdates = confirmUpdates;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const emailSchema = zod_1.z
    .string()
    .trim()
    .max(254)
    .email()
    .transform(value => value.toLowerCase());
exports.CONSENT_VERSION = 'hoyst-updates-checkbox-2026-10-22';
exports.CONSENT_TEXT = 'Email me Hoyst news, new features, and launch updates. Unsubscribe anytime.';
const DAY = 86400000;
class UpdatesError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.UpdatesError = UpdatesError;
const tokenDigest = (token) => (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
exports.tokenDigest = tokenDigest;
function privateKey(secret, kind, value) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(`${kind}:${value}`).digest('hex');
}
function milliseconds(value) {
    return value instanceof firestore_1.Timestamp ? value.toMillis() : 0;
}
// Retained for legacy confirmation-flow compatibility. New signups use subscribeUpdates.
async function requestUpdates(emailInput, ip, deps) {
    const parsed = emailSchema.safeParse(emailInput);
    if (!parsed.success) {
        throw new UpdatesError(400, 'Enter a valid email address.');
    }
    if (deps.available === false || !deps.secret || deps.secret.length < 32) {
        throw new UpdatesError(503, 'Email updates aren’t available just yet. Please try again soon.');
    }
    const email = parsed.data;
    const now = (deps.now || Date.now)();
    const token = deps.token?.() || (0, node_crypto_1.randomBytes)(32).toString('base64url');
    const digest = (0, exports.tokenDigest)(token);
    const signupRef = deps.db
        .collection('websiteUpdateSignups')
        .doc(privateKey(deps.secret, 'email', email));
    const ipRef = deps.db
        .collection('websiteUpdateRateLimits')
        .doc(privateKey(deps.secret, 'ip', `${Math.floor(now / 3600000)}:${ip}`));
    const tokenRef = deps.db.collection('websiteUpdateTokens').doc(digest);
    const globalLimits = [
        {
            ref: deps.db
                .collection('websiteUpdateRateLimits')
                .doc(`global-hour-${Math.floor(now / 3600000)}`),
            max: 80,
        },
        {
            ref: deps.db
                .collection('websiteUpdateRateLimits')
                .doc(`global-day-${Math.floor(now / DAY)}`),
            max: 250,
        },
    ];
    const shouldSend = await deps.db.runTransaction(async (tx) => {
        const [signup, rate, ...globalRates] = await Promise.all([
            tx.get(signupRef),
            tx.get(ipRef),
            ...globalLimits.map(limit => tx.get(limit.ref)),
        ]);
        const previous = signup.data();
        const count = Number(rate.data()?.count || 0);
        if (count >= 10) {
            throw new UpdatesError(429, 'Too many requests. Please try again in an hour.');
        }
        tx.set(ipRef, {
            count: count + 1,
            expiresAt: firestore_1.Timestamp.fromMillis(now + DAY),
        });
        // Generic response prevents disclosing membership or changing unsubscribe preferences.
        if (previous?.status === 'confirmed' ||
            previous?.status === 'subscribed' ||
            previous?.status === 'unsubscribed') {
            return false;
        }
        if (milliseconds(previous?.lastSentAt) > now - 60000) {
            return false;
        }
        const windowStart = milliseconds(previous?.windowStart);
        const requests = windowStart > now - 3600000 ? Number(previous?.requests || 0) : 0;
        if (requests >= 3) {
            throw new UpdatesError(429, 'Please wait an hour before requesting another email.');
        }
        if (globalRates.some((snapshot, index) => Number(snapshot.data()?.count || 0) >= globalLimits[index].max)) {
            throw new UpdatesError(429, 'Email updates are busy right now. Please try again later.');
        }
        globalLimits.forEach((limit, index) => tx.set(limit.ref, {
            count: Number(globalRates[index].data()?.count || 0) + 1,
            expiresAt: firestore_1.Timestamp.fromMillis(now + DAY),
        }));
        tx.set(signupRef, {
            email,
            status: 'pending',
            tokenHash: digest,
            lastSentAt: firestore_1.Timestamp.fromMillis(now),
            windowStart: firestore_1.Timestamp.fromMillis(requests ? windowStart : now),
            requests: requests + 1,
            consentVersion: 'hoyst-updates-2026-10-21',
            source: 'website',
            expiresAt: firestore_1.Timestamp.fromMillis(now + 2 * DAY),
        });
        tx.create(tokenRef, {
            signupId: signupRef.id,
            state: 'pending',
            expiresAt: firestore_1.Timestamp.fromMillis(now + DAY),
        });
        return true;
    });
    if (!shouldSend) {
        return;
    }
    try {
        // Reserve against local caps before touching the shared email provider.
        await deps.provider.ready();
        await deps.provider.sendConfirmation(email, `${deps.origin}/updates/confirm#${encodeURIComponent(token)}`, digest);
    }
    catch {
        // Release the cooldown only for this attempt, without weakening the hourly limit.
        await deps.db.runTransaction(async (tx) => {
            const current = await tx.get(signupRef);
            if (current.data()?.status === 'pending' &&
                current.data()?.tokenHash === digest) {
                tx.update(signupRef, { lastSentAt: firestore_1.Timestamp.fromMillis(0) });
            }
        });
        throw new UpdatesError(503, 'We couldn’t send the confirmation email. Please try again.');
    }
}
async function subscribeUpdates(emailInput, consent, ip, deps) {
    const parsed = emailSchema.safeParse(emailInput);
    if (!parsed.success) {
        throw new UpdatesError(400, 'Enter a valid email address.');
    }
    if (consent !== true) {
        throw new UpdatesError(400, 'Please agree to receive Hoyst emails. Refresh this page if the checkbox is missing.');
    }
    if (deps.available === false || !deps.secret || deps.secret.length < 32) {
        throw new UpdatesError(503, 'Email updates aren’t available just yet. Please try again soon.');
    }
    const email = parsed.data;
    const now = (deps.now || Date.now)();
    const claim = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const signupRef = deps.db
        .collection('websiteUpdateSignups')
        .doc(privateKey(deps.secret, 'email', email));
    const ipRef = deps.db
        .collection('websiteUpdateRateLimits')
        .doc(privateKey(deps.secret, 'ip', `${Math.floor(now / 3600000)}:${ip}`));
    const limits = [
        {
            ref: deps.db
                .collection('websiteUpdateRateLimits')
                .doc(`global-hour-${Math.floor(now / 3600000)}`),
            max: 80,
        },
        {
            ref: deps.db
                .collection('websiteUpdateRateLimits')
                .doc(`global-day-${Math.floor(now / DAY)}`),
            max: 250,
        },
    ];
    const shouldSubscribe = await deps.db.runTransaction(async (tx) => {
        const [signup, rate, ...counts] = await Promise.all([
            tx.get(signupRef),
            tx.get(ipRef),
            ...limits.map(limit => tx.get(limit.ref)),
        ]);
        const previous = signup.data();
        const count = Number(rate.data()?.count || 0);
        if (count >= 10) {
            throw new UpdatesError(429, 'Too many requests. Please try again in an hour.');
        }
        tx.set(ipRef, {
            count: count + 1,
            expiresAt: firestore_1.Timestamp.fromMillis(now + DAY),
        });
        // Keep the response generic and never re-enroll a previously processed address.
        if (['confirmed', 'subscribed', 'unsubscribed'].includes(previous?.status)) {
            return false;
        }
        if (milliseconds(previous?.processingUntil) > now) {
            throw new UpdatesError(409, 'Your signup is being processed. Please try again in a moment.');
        }
        const start = milliseconds(previous?.windowStart);
        const requests = start > now - 3600000 ? Number(previous?.requests || 0) : 0;
        if (requests >= 3 ||
            counts.some((snapshot, index) => Number(snapshot.data()?.count || 0) >= limits[index].max)) {
            throw new UpdatesError(429, 'Too many requests. Please try again in an hour.');
        }
        limits.forEach((limit, index) => tx.set(limit.ref, {
            count: Number(counts[index].data()?.count || 0) + 1,
            expiresAt: firestore_1.Timestamp.fromMillis(now + DAY),
        }));
        tx.set(signupRef, {
            email,
            status: 'processing',
            processingClaim: claim,
            processingUntil: firestore_1.Timestamp.fromMillis(now + 120000),
            requests: requests + 1,
            windowStart: firestore_1.Timestamp.fromMillis(requests ? start : now),
            consentVersion: exports.CONSENT_VERSION,
            consentText: exports.CONSENT_TEXT,
            consentMethod: 'website_checkbox',
            consentedAt: firestore_1.Timestamp.fromMillis(now),
            emailVerified: previous?.emailVerified === true,
            source: 'website',
            expiresAt: firestore_1.Timestamp.fromMillis(now + 2 * DAY),
        }, { merge: true });
        return true;
    });
    if (!shouldSubscribe) {
        return;
    }
    try {
        await deps.provider.ready();
        const outcome = await deps.provider.subscribe(email);
        await deps.db.runTransaction(async (tx) => {
            const current = (await tx.get(signupRef)).data();
            if (current?.processingClaim !== claim) {
                throw new UpdatesError(409, 'Your signup is being processed. Please try again in a moment.');
            }
            tx.update(signupRef, {
                status: outcome === 'subscribed' ? 'subscribed' : 'unsubscribed',
                processedAt: firestore_1.Timestamp.fromMillis(now),
                ...(outcome === 'subscribed'
                    ? { subscribedAt: firestore_1.Timestamp.fromMillis(now) }
                    : {}),
                processingClaim: firestore_1.FieldValue.delete(),
                processingUntil: firestore_1.FieldValue.delete(),
                expiresAt: firestore_1.FieldValue.delete(),
            });
        });
    }
    catch (error) {
        await deps.db.runTransaction(async (tx) => {
            const current = (await tx.get(signupRef)).data();
            if (current?.processingClaim === claim) {
                tx.update(signupRef, {
                    status: 'pending',
                    processingClaim: firestore_1.FieldValue.delete(),
                    processingUntil: firestore_1.FieldValue.delete(),
                });
            }
        });
        if (error instanceof UpdatesError) {
            throw error;
        }
        throw new UpdatesError(503, 'We couldn’t save your email preferences. Please try again.');
    }
}
async function confirmUpdates(token, deps) {
    if (deps.available === false) {
        throw new UpdatesError(503, 'Email updates aren’t available just yet. Please try again soon.');
    }
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new UpdatesError(400, 'This confirmation link is invalid. Use the signup form on the homepage.');
    }
    const now = (deps.now || Date.now)();
    const digest = (0, exports.tokenDigest)(token);
    const tokenRef = deps.db.collection('websiteUpdateTokens').doc(digest);
    const claim = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const state = await deps.db.runTransaction(async (tx) => {
        const record = (await tx.get(tokenRef)).data();
        if (!record || milliseconds(record.expiresAt) <= now) {
            throw new UpdatesError(410, 'This link has expired. Join Hoyst updates using the checkbox on the homepage.');
        }
        if (record.state === 'confirmed') {
            return { result: 'already' };
        }
        if (record.state === 'unsubscribed') {
            return { result: 'unsubscribed' };
        }
        if (milliseconds(record.processingUntil) > now) {
            throw new UpdatesError(409, 'Your confirmation is being processed. Please try again in a moment.');
        }
        const signupRef = deps.db
            .collection('websiteUpdateSignups')
            .doc(record.signupId);
        const signup = (await tx.get(signupRef)).data();
        if (!signup || signup.tokenHash !== digest) {
            throw new UpdatesError(410, 'This older link is no longer active. Use your latest email link or the signup form on the homepage.');
        }
        if (signup.status === 'subscribed' || signup.status === 'confirmed') {
            return { result: 'already' };
        }
        if (signup.status === 'unsubscribed') {
            return { result: 'unsubscribed' };
        }
        if (milliseconds(signup.processingUntil) > now) {
            throw new UpdatesError(409, 'Your signup is being processed. Please try again in a moment.');
        }
        tx.update(tokenRef, {
            claim,
            processingUntil: firestore_1.Timestamp.fromMillis(now + 120000),
        });
        return { signupId: signupRef.id, email: signup.email };
    });
    if ('result' in state) {
        return state.result;
    }
    try {
        await deps.provider.ready();
        const outcome = await deps.provider.subscribe(state.email);
        const status = outcome === 'subscribed' ? 'confirmed' : 'unsubscribed';
        await deps.db.runTransaction(async (tx) => {
            const current = (await tx.get(tokenRef)).data();
            if (current?.claim !== claim) {
                throw new UpdatesError(409, 'Please try confirming again.');
            }
            const signupRef = deps.db
                .collection('websiteUpdateSignups')
                .doc(state.signupId);
            const signup = (await tx.get(signupRef)).data();
            if (signup?.tokenHash !== digest) {
                throw new UpdatesError(410, 'Use the confirmation link in your latest email.');
            }
            tx.update(tokenRef, {
                state: status,
                processingUntil: firestore_1.FieldValue.delete(),
                claim: firestore_1.FieldValue.delete(),
            });
            tx.update(signupRef, {
                status,
                confirmedAt: firestore_1.Timestamp.fromMillis(now),
                emailVerified: true,
                expiresAt: firestore_1.FieldValue.delete(),
            });
        });
        return status;
    }
    catch (error) {
        await deps.db.runTransaction(async (tx) => {
            const current = (await tx.get(tokenRef)).data();
            if (current?.claim === claim) {
                tx.update(tokenRef, {
                    processingUntil: firestore_1.FieldValue.delete(),
                    claim: firestore_1.FieldValue.delete(),
                });
            }
        });
        if (error instanceof UpdatesError) {
            throw error;
        }
        throw new UpdatesError(503, 'We couldn’t finish confirming your email. Please try this button again.');
    }
}
