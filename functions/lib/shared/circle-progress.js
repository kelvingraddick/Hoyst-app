"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftCircleDate = shiftCircleDate;
exports.circleDateKey = circleDateKey;
exports.circlePeriodForDate = circlePeriodForDate;
exports.circleDates = circleDates;
exports.circleStreakUnit = circleStreakUnit;
exports.formatCircleStreak = formatCircleStreak;
exports.isCircleDateEligible = isCircleDateEligible;
exports.evaluateMemberPeriod = evaluateMemberPeriod;
exports.groupPeriodOutcome = groupPeriodOutcome;
exports.countCirclePeriodStreak = countCirclePeriodStreak;
exports.circleProgressConfiguration = circleProgressConfiguration;
exports.readCircleProgress = readCircleProgress;
function shiftCircleDate(key, days) {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
function circleDateKey(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const part = (type) => parts.find(item => item.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
}
function circlePeriodForDate(dateKey, cadence) {
    if (cadence === 'daily') {
        return { key: dateKey, start: dateKey, end: dateKey };
    }
    const date = new Date(`${dateKey}T12:00:00Z`);
    if (cadence === 'weekly') {
        const start = shiftCircleDate(dateKey, -((date.getUTCDay() + 6) % 7));
        return { key: start, start, end: shiftCircleDate(start, 6) };
    }
    const start = `${dateKey.slice(0, 7)}-01`;
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12))
        .toISOString()
        .slice(0, 10);
    return { key: dateKey.slice(0, 7), start, end };
}
function circleDates(start, end) {
    const result = [];
    for (let day = start; day <= end; day = shiftCircleDate(day, 1)) {
        result.push(day);
    }
    return result;
}
function circleStreakUnit(cadence) {
    return cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month';
}
function formatCircleStreak(streak) {
    if (!streak || streak.availability !== 'ready' || streak.count === null) {
        return '—';
    }
    return `${streak.count} ${streak.unit}${streak.count === 1 ? '' : 's'}`;
}
function isCircleDateEligible(day, spans, intervals, includeCoveredEndDate = false) {
    return (spans.some(span => span.start <= day &&
        (!span.end ||
            day < span.end ||
            (includeCoveredEndDate && day === span.end))) &&
        intervals.some(interval => interval.start <= day &&
            (!interval.end ||
                day < interval.end ||
                (includeCoveredEndDate && day === interval.end))));
}
function evaluateMemberPeriod({ period, uid, spans, intervals, target, coveredDates, today, known = true, }) {
    const memberSpans = spans.filter(span => span.uid === uid);
    const eligible = circleDates(period.start, period.end).filter(day => isCircleDateEligible(day, memberSpans, intervals));
    // Already recorded coverage on the departure/archive date remains earned.
    // Uncovered requirements on that date are canceled by the transition.
    const coveredEligible = circleDates(period.start, period.end).filter(day => coveredDates.has(day) &&
        day <= today &&
        isCircleDateEligible(day, memberSpans, intervals, true));
    // Target depends on entry/resume eligibility, not how many unmissed days remain today.
    const possibleAtEntry = circleDates(period.start, period.end).filter(day => memberSpans.some(span => span.start <= day && (!span.end || span.end >= period.start)) &&
        intervals.some(interval => interval.start <= day &&
            (!interval.end || interval.end >= period.start))).length;
    const required = eligible.length || coveredEligible.length
        ? Math.min(Math.max(1, Math.round(target)), possibleAtEntry)
        : 0;
    const covered = Math.min(required, coveredEligible.length);
    const remaining = eligible.filter(day => day >= today && !coveredDates.has(day)).length;
    const interrupted = memberSpans.some(span => span.end && span.end >= period.start && span.end <= period.end) ||
        intervals.some(interval => interval.end &&
            interval.end >= period.start &&
            interval.end <= period.end);
    const outcome = !known
        ? 'unknown'
        : required === 0
            ? 'neutral'
            : covered >= required
                ? 'secured'
                : interrupted
                    ? 'neutral'
                    : covered + remaining < required
                        ? 'broken'
                        : 'open';
    return { ...period, uid, required, covered, remaining, outcome };
}
function groupPeriodOutcome(members, known) {
    if (!known || members.some(member => member.outcome === 'unknown')) {
        return 'unknown';
    }
    const expected = members.filter(member => member.outcome !== 'neutral');
    if (!expected.length) {
        return 'neutral';
    }
    if (expected.some(member => member.outcome === 'broken')) {
        return 'broken';
    }
    return expected.every(member => member.outcome === 'secured')
        ? 'secured'
        : 'open';
}
function countCirclePeriodStreak(periods, unit) {
    let count = 0;
    let openAllowed = true;
    for (let index = periods.length - 1; index >= 0; index--) {
        const { outcome } = periods[index];
        if (outcome === 'neutral') {
            continue;
        }
        if (outcome === 'unknown') {
            return { count: null, unit, availability: 'unavailable' };
        }
        if (outcome === 'open' && openAllowed) {
            openAllowed = false;
            continue;
        }
        if (outcome !== 'secured') {
            break;
        }
        count++;
        openAllowed = false;
    }
    return { count, unit, availability: 'ready' };
}
function circleProgressConfiguration(circle) {
    const frequency = (circle.commitmentFrequency ?? {});
    const cadence = circle.commitmentCadence === 'daily' ||
        circle.commitmentCadence === 'weekly' ||
        circle.commitmentCadence === 'monthly'
        ? circle.commitmentCadence
        : Number(frequency.tapInsPerWeek) >= 7
            ? 'daily'
            : 'weekly';
    const target = cadence === 'daily'
        ? 1
        : Math.min(cadence === 'weekly' ? 7 : 31, Math.max(1, Math.round(Number(frequency.opportunitiesPerPeriod ?? frequency.tapInsPerWeek) || (cadence === 'weekly' ? 7 : 4))));
    const timezone = typeof circle.timezone === 'string' ? circle.timezone : 'UTC';
    return {
        cadence,
        target,
        timezone,
        revision: JSON.stringify([2, cadence, target, timezone]),
    };
}
function readCircleProgress(value, circle) {
    const data = value;
    if (data?.version !== 2 || !data.streak || !data.progress || !data.period) {
        return undefined;
    }
    if (!['daily', 'weekly', 'monthly'].includes(data.cadence) ||
        data.streak.unit !== circleStreakUnit(data.cadence) ||
        !['ready', 'unavailable', 'recalculating'].includes(data.streak.availability) ||
        (data.streak.count !== null &&
            (!Number.isInteger(data.streak.count) || data.streak.count < 0)) ||
        (data.streak.availability === 'ready' && data.streak.count === null) ||
        !Number.isFinite(data.progress.covered) ||
        data.progress.covered < 0 ||
        !Number.isFinite(data.progress.required) ||
        data.progress.required < 0) {
        return undefined;
    }
    if (circle) {
        const config = circleProgressConfiguration(circle);
        if (data.revision !== config.revision ||
            (circle.lifecycleStatus !== 'archived' &&
                data.asOfDateKey !== circleDateKey(config.timezone))) {
            return undefined;
        }
    }
    return data;
}
