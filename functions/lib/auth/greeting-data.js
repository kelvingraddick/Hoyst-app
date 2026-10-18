"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireHomeGreetingData = void 0;
exports.deleteGreetingData = deleteGreetingData;
exports.expireGreetingData = expireGreetingData;
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_1 = require("../firebase");
async function deleteGreetingData(uid) {
    const [caches, usage] = await Promise.all([
        firebase_1.db.collection('homeGreetingCache').where('ownerUid', '==', uid).get(),
        firebase_1.db.collectionGroup('users').where('uid', '==', uid).get(),
    ]);
    const refs = [
        ...caches.docs,
        ...usage.docs.filter(doc => /^homeGreetingUsage\/[^/]+\/users\/[^/]+$/.test(doc.ref.path)),
    ];
    for (let index = 0; index < refs.length; index += 400) {
        const batch = firebase_1.db.batch();
        refs.slice(index, index + 400).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}
/** Also expires legacy cache entries that predate ownerUid tagging. */
async function expireGreetingData(now = Date.now()) {
    const cutoff = firestore_1.Timestamp.fromMillis(now - 48 * 60 * 60 * 1000);
    for (const collection of ['homeGreetingCache', 'homeGreetingUsage']) {
        for (let page = 0; page < 10; page++) {
            const expired = await firebase_1.db
                .collection(collection)
                .where('updatedAt', '<=', cutoff)
                .limit(100)
                .get();
            if (expired.empty)
                break;
            for (const doc of expired.docs)
                await firebase_1.db.recursiveDelete(doc.ref);
        }
    }
}
exports.expireHomeGreetingData = (0, scheduler_1.onSchedule)('every 60 minutes', () => expireGreetingData());
