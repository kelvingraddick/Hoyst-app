"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreviousDateKey = getPreviousDateKey;
exports.getRollingDateKeys = getRollingDateKeys;
exports.canUseSkipGrace = canUseSkipGrace;
function padDatePart(value) {
    return value.toString().padStart(2, '0');
}
function getPreviousDateKey(dateKey) {
    const [year = '1970', month = '01', day = '01'] = dateKey.split('-');
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    date.setUTCDate(date.getUTCDate() - 1);
    return [
        date.getUTCFullYear(),
        padDatePart(date.getUTCMonth() + 1),
        padDatePart(date.getUTCDate()),
    ].join('-');
}
function getRollingDateKeys(todayDateKey, windowDays) {
    const dateKeys = [];
    const windowSize = Math.max(1, Math.round(windowDays));
    let cursor = todayDateKey;
    for (let index = 0; index < windowSize; index += 1) {
        dateKeys.push(cursor);
        cursor = getPreviousDateKey(cursor);
    }
    return dateKeys;
}
function canUseSkipGrace({ graceRule, priorSkipCount, }) {
    const allowance = Math.max(0, Math.round(graceRule?.allowance ?? 0));
    if (allowance <= 0) {
        return false;
    }
    return priorSkipCount < allowance;
}
