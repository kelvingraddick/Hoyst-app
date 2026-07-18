"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMemberExpectedForSlot = isMemberExpectedForSlot;
exports.getEligibleOpenSlot = getEligibleOpenSlot;
const schedule_1 = require("./schedule");
function toDate(value) {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    if (value && typeof value === 'object') {
        if ('toDate' in value && typeof value.toDate === 'function') {
            return value.toDate();
        }
        if ('seconds' in value && typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000);
        }
    }
    return undefined;
}
function getMembershipDateKey(value, timezone) {
    const date = toDate(value);
    return date ? (0, schedule_1.getDateKey)(timezone, date) : undefined;
}
function isMemberExpectedForSlot({ member, slot, timezone, }) {
    if (!member || member.status !== 'active') {
        return false;
    }
    const joinedDateKey = getMembershipDateKey(member.joinedAt, timezone);
    const leftDateKey = getMembershipDateKey(member.leftAt, timezone);
    if (leftDateKey && slot.expiresDateKey >= leftDateKey) {
        return false;
    }
    if (!joinedDateKey) {
        return true;
    }
    if (slot.availableDateKey > joinedDateKey) {
        return true;
    }
    return (member.opportunityEligibility === 'include_current' &&
        slot.availableDateKey <= joinedDateKey &&
        slot.expiresDateKey >= joinedDateKey);
}
function getEligibleOpenSlot({ dateKey, existingStatuses, member, slots, timezone, }) {
    return slots.find(slot => {
        const status = existingStatuses.get(slot.slotIndex);
        return (isMemberExpectedForSlot({ member, slot, timezone }) &&
            slot.availableDateKey <= dateKey &&
            slot.expiresDateKey >= dateKey &&
            status !== 'completed' &&
            status !== 'skipped');
    });
}
