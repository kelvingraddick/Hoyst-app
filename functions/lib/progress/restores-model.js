"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restoreCandidate = restoreCandidate;
const covered = (slot) => slot.status === 'completed' || slot.status === 'skipped';
/** Only the latest gap can reconnect continuity. Adjacent gaps cannot be repaired one at a time. */
function restoreCandidate(slots, today) {
    const ordered = slots
        .filter(slot => slot.expectedForCircle !== false && slot.availableDateKey <= today)
        .sort((a, b) => a.availableDateKey.localeCompare(b.availableDateKey) ||
        a.slotIndex - b.slotIndex);
    let index = -1;
    ordered.forEach((slot, at) => {
        if (slot.expiresDateKey < today && !covered(slot)) {
            index = at;
        }
    });
    if (index <= 0 || !covered(ordered[index - 1])) {
        return undefined;
    }
    if (ordered
        .slice(index + 1)
        .some(slot => slot.expiresDateKey < today && !covered(slot))) {
        return undefined;
    }
    // A repair must reconnect known coverage through the latest closed window.
    // Old gaps remain eligible indefinitely when the complete intervening history exists.
    const yesterday = new Date(Date.parse(today) - 86400000)
        .toISOString()
        .slice(0, 10);
    if (ordered[ordered.length - 1].expiresDateKey < yesterday)
        return undefined;
    if (!adjacent(ordered[index - 1], ordered[index]))
        return undefined;
    for (let at = index + 1; at < ordered.length; at++) {
        if (!adjacent(ordered[at - 1], ordered[at]))
            return undefined;
    }
    let before = 0, after = 0;
    for (let at = index - 1; at >= 0 && covered(ordered[at]); at--) {
        if (!adjacent(ordered[at], ordered[at + 1]))
            break;
        before++;
    }
    for (let at = index + 1; at < ordered.length && covered(ordered[at]); at++)
        after++;
    return {
        slot: ordered[index],
        currentStreak: after,
        resultingStreak: before + after + 1,
    };
}
function adjacent(prior, next) {
    if (next.periodKey === prior.periodKey)
        return next.slotIndex === prior.slotIndex + 1;
    if (!prior.cadence || prior.cadence === 'daily') {
        return (Date.parse(next.availableDateKey) - Date.parse(prior.availableDateKey) ===
            86400000);
    }
    if (prior.cadence !== 'weekly' && prior.cadence !== 'monthly')
        return false;
    if (!prior.opportunitiesPerPeriod ||
        prior.slotIndex !== prior.opportunitiesPerPeriod - 1 ||
        next.slotIndex !== 0)
        return false;
    const period = new Date(prior.periodKey.length === 7 ? prior.periodKey + '-01' : prior.periodKey);
    if (prior.cadence === 'weekly')
        period.setUTCDate(period.getUTCDate() + 7);
    else
        period.setUTCMonth(period.getUTCMonth() + 1);
    return (next.periodKey ===
        period.toISOString().slice(0, prior.cadence === 'monthly' ? 7 : 10));
}
