"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateKey = getDateKey;
exports.getPreviousDateKey = getPreviousDateKey;
exports.calculatePersonalDailyStreak = calculatePersonalDailyStreak;
function padDatePart(value) {
    return value.toString().padStart(2, '0');
}
function getDateKey(date, timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        year: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(part => part.type === 'year')?.value ?? '1970';
    const month = parts.find(part => part.type === 'month')?.value ?? '01';
    const day = parts.find(part => part.type === 'day')?.value ?? '01';
    return `${year}-${month}-${day}`;
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
function calculatePersonalDailyStreak({ checkInDateKeys, now = new Date(), timezone, }) {
    const completedDateKeys = new Set(checkInDateKeys);
    const todayDateKey = getDateKey(now, timezone);
    const hasTappedInToday = completedDateKeys.has(todayDateKey);
    let cursorDateKey = hasTappedInToday
        ? todayDateKey
        : getPreviousDateKey(todayDateKey);
    let personalStreakDays = 0;
    while (completedDateKeys.has(cursorDateKey)) {
        personalStreakDays += 1;
        cursorDateKey = getPreviousDateKey(cursorDateKey);
    }
    return {
        hasTappedInToday,
        personalStreakDays,
    };
}
