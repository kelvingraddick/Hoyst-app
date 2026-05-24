"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHomeGreeting = void 0;
exports.buildHomeGreetingCacheKey = buildHomeGreetingCacheKey;
exports.buildHomeGreetingFallback = buildHomeGreetingFallback;
exports.validateHomeGreetingHeadline = validateHomeGreetingHeadline;
exports.buildHomeGreetingPrompt = buildHomeGreetingPrompt;
exports.parseGeminiHomeGreetingResponse = parseGeminiHomeGreetingResponse;
exports.resolveHomeGreeting = resolveHomeGreeting;
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_1 = require("./firebase");
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const maxHeadlineLength = 90;
const maxDailyGenerationsPerUser = 4;
const maxDailyGlobalGenerations = 4000;
const homeGreetingSchema = zod_1.z.object({
    circleSummary: zod_1.z.object({
        atRiskCount: zod_1.z.number().int().min(0).max(99),
        circleCount: zod_1.z.number().int().min(0).max(99),
        doneCount: zod_1.z.number().int().min(0).max(99),
        needsYouCount: zod_1.z.number().int().min(0).max(99),
        pendingCount: zod_1.z.number().int().min(0).max(99),
    }),
    dateKey: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    firstName: zod_1.z.string().trim().max(24).optional(),
    timeWindow: zod_1.z.enum(['morning', 'midday', 'afternoon', 'evening']),
});
const headlineResponseSchema = zod_1.z.object({
    headline: zod_1.z.string(),
});
function warnHomeGreetingFallback(reason, input) {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    console.warn('home_greeting_fallback', {
        reason,
        timeWindow: input.timeWindow,
    });
}
function cleanFirstName(value) {
    const firstName = value
        ?.trim()
        .split(/\s+/)[0]
        ?.replace(/[^A-Za-z'-]/g, '');
    return firstName && firstName.length > 0 ? firstName.slice(0, 24) : undefined;
}
function cleanCachePart(value) {
    return encodeURIComponent(value).replace(/\./g, '%2E');
}
function buildHomeGreetingCacheKey({ input, uid, }) {
    const { circleSummary } = input;
    return [
        'v1',
        cleanCachePart(uid),
        input.dateKey,
        input.timeWindow,
        cleanCachePart(cleanFirstName(input.firstName) ?? 'anon'),
        circleSummary.circleCount,
        circleSummary.needsYouCount,
        circleSummary.atRiskCount,
        circleSummary.doneCount,
        circleSummary.pendingCount,
    ].join('_');
}
function withName(firstName, copy, copyWithoutName) {
    return firstName ? `${firstName}, ${copy}` : copyWithoutName ?? copy;
}
function buildHomeGreetingFallback(input, reason) {
    const firstName = cleanFirstName(input.firstName);
    const { circleSummary, timeWindow } = input;
    let headline;
    if (circleSummary.circleCount === 0) {
        headline = withName(firstName, 'no circles yet. Bold strategy, let us fix it.', 'No circles yet. Bold strategy, let us fix it.');
    }
    else if (circleSummary.needsYouCount > 0) {
        headline = withName(firstName, 'your circles are waiting. Make it quick and undeniable.', 'Your circles are waiting. Make it quick and undeniable.');
    }
    else if (circleSummary.atRiskCount > 0) {
        headline = withName(firstName, 'pressure is up. Perfect, now it counts.', 'Pressure is up. Perfect, now it counts.');
    }
    else if (circleSummary.pendingCount > 0) {
        headline = withName(firstName, 'pending approval. Patience, but make it productive.', 'Pending approval. Patience, but make it productive.');
    }
    else if (circleSummary.doneCount === circleSummary.circleCount) {
        headline = withName(firstName, 'all checked in. Try not to act surprised.', 'All checked in. Try not to act surprised.');
    }
    else if (timeWindow === 'morning') {
        headline = withName(firstName, 'morning. New day, same Commitment, fewer excuses.', 'Morning. New day, same Commitment, fewer excuses.');
    }
    else if (timeWindow === 'midday') {
        headline = withName(firstName, 'midday check. Winning, or just looking busy?', 'Midday check. Winning, or just looking busy?');
    }
    else if (timeWindow === 'afternoon') {
        headline = withName(firstName, 'afternoon test. Finish strong so tonight feels earned.', 'Afternoon test. Finish strong so tonight feels earned.');
    }
    else {
        headline = withName(firstName, 'last lap. Make the day look planned.', 'Last lap. Make the day look planned.');
    }
    if (reason) {
        warnHomeGreetingFallback(reason, input);
    }
    return { headline, source: 'fallback' };
}
function getGeminiApiKey() {
    try {
        return process.env.GEMINI_API_KEY ?? geminiApiKey.value();
    }
    catch {
        return process.env.GEMINI_API_KEY;
    }
}
const firestoreHomeGreetingCacheStore = {
    async getCachedGreeting(cacheKey, input) {
        const snapshot = await firebase_1.db.collection('homeGreetingCache').doc(cacheKey).get();
        const data = snapshot.data();
        const headline = validateHomeGreetingHeadline({
            firstName: input.firstName,
            headline: data?.headline,
        });
        return data?.source === 'gemini' && headline
            ? { headline, source: 'gemini' }
            : undefined;
    },
    async reserveGeneration(uid, dateKey) {
        const usageRef = firebase_1.db.collection('homeGreetingUsage').doc(dateKey);
        const userUsageRef = usageRef.collection('users').doc(uid);
        return firebase_1.db.runTransaction(async (transaction) => {
            const [usageSnapshot, userUsageSnapshot] = await Promise.all([
                transaction.get(usageRef),
                transaction.get(userUsageRef),
            ]);
            const usageCount = Number(usageSnapshot.data()?.generationCount ?? 0);
            const userUsageCount = Number(userUsageSnapshot.data()?.generationCount ?? 0);
            if (usageCount >= maxDailyGlobalGenerations) {
                return 'global-cap';
            }
            if (userUsageCount >= maxDailyGenerationsPerUser) {
                return 'user-cap';
            }
            transaction.set(usageRef, {
                dateKey,
                generationCount: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            transaction.set(userUsageRef, {
                generationCount: firestore_1.FieldValue.increment(1),
                uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            }, { merge: true });
            return 'allowed';
        });
    },
    async setCachedGreeting(cacheKey, input, result) {
        if (result.source !== 'gemini') {
            return;
        }
        await firebase_1.db
            .collection('homeGreetingCache')
            .doc(cacheKey)
            .set({
            circleSummary: input.circleSummary,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            dateKey: input.dateKey,
            firstName: cleanFirstName(input.firstName) ?? null,
            headline: result.headline,
            source: 'gemini',
            timeWindow: input.timeWindow,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    },
};
function validateHomeGreetingHeadline({ firstName, headline, }) {
    if (typeof headline !== 'string') {
        return undefined;
    }
    const trimmedHeadline = headline.trim();
    const cleanName = cleanFirstName(firstName);
    if (!trimmedHeadline || trimmedHeadline.length > maxHeadlineLength) {
        return undefined;
    }
    if (/[\r\n]/.test(trimmedHeadline)) {
        return undefined;
    }
    if (/[—–]/.test(trimmedHeadline)) {
        return undefined;
    }
    if (/\p{Extended_Pictographic}/u.test(trimmedHeadline)) {
        return undefined;
    }
    if (cleanName &&
        !trimmedHeadline.toLowerCase().includes(cleanName.toLowerCase())) {
        return undefined;
    }
    if (/\b(idiot|stupid|dumb|lazy|loser|hate|worthless|trash)\b/i.test(trimmedHeadline)) {
        return undefined;
    }
    return trimmedHeadline;
}
function buildHomeGreetingPrompt(input) {
    const firstName = cleanFirstName(input.firstName);
    const nameInstruction = firstName
        ? `Include the first name exactly as "${firstName}".`
        : 'Do not invent a name.';
    return [
        'Write one short Hoyst Home headline for a daily accountability app.',
        'Tone: playful motivational push, witty but not cruel.',
        'Return JSON only with shape {"headline":"..."}',
        'Rules: 90 characters max, no emoji, no profanity, no em dash, no newline.',
        nameInstruction,
        `Time window: ${input.timeWindow}.`,
        `Circle counts: ${JSON.stringify(input.circleSummary)}.`,
    ].join('\n');
}
function parseGeminiHomeGreetingResponse(payload) {
    const data = payload;
    const text = data.candidates?.[0]?.content?.parts
        ?.map(part => (typeof part.text === 'string' ? part.text : ''))
        .join('')
        .trim();
    if (!text) {
        return undefined;
    }
    try {
        return headlineResponseSchema.parse(JSON.parse(text)).headline;
    }
    catch {
        return undefined;
    }
}
async function resolveHomeGreeting({ apiKey = getGeminiApiKey(), cacheStore, fetchImpl = fetch, input, uid, }) {
    const fallback = (reason) => buildHomeGreetingFallback(input, reason);
    const cacheKey = cacheStore && uid ? buildHomeGreetingCacheKey({ input, uid }) : undefined;
    if (cacheStore && cacheKey) {
        const cachedGreeting = await cacheStore.getCachedGreeting(cacheKey, input);
        if (cachedGreeting) {
            return cachedGreeting;
        }
    }
    if (!apiKey) {
        return fallback('missing-api-key');
    }
    if (cacheStore && cacheKey && uid) {
        const reservation = await cacheStore.reserveGeneration(uid, input.dateKey);
        if (reservation !== 'allowed') {
            return fallback('daily-budget');
        }
    }
    try {
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: buildHomeGreetingPrompt(input) }],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: 48,
                    response_mime_type: 'application/json',
                    response_schema: {
                        properties: {
                            headline: { type: 'STRING' },
                        },
                        required: ['headline'],
                        type: 'OBJECT',
                    },
                    temperature: 0.8,
                },
            }),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
        });
        if (!response.ok) {
            console.warn('home_greeting_gemini_http_error', {
                status: response.status,
                statusText: response.statusText,
            });
            return fallback('gemini-http');
        }
        const headline = validateHomeGreetingHeadline({
            firstName: input.firstName,
            headline: parseGeminiHomeGreetingResponse(await response.json()),
        });
        if (!headline) {
            return fallback('invalid-output');
        }
        const result = { headline, source: 'gemini' };
        if (cacheStore && cacheKey) {
            await cacheStore.setCachedGreeting(cacheKey, input, result);
        }
        return result;
    }
    catch (error) {
        console.warn('home_greeting_gemini_error', {
            message: error instanceof Error ? error.message : String(error),
        });
        return fallback('gemini-error');
    }
}
exports.generateHomeGreeting = (0, https_1.onCall)({ secrets: [geminiApiKey] }, async (request) => {
    const input = homeGreetingSchema.parse(request.data);
    if (!request.auth?.uid) {
        return buildHomeGreetingFallback(input, 'unauthenticated');
    }
    return resolveHomeGreeting({
        cacheStore: firestoreHomeGreetingCacheStore,
        input,
        uid: request.auth.uid,
    });
});
