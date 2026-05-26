"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateKey = getDateKey;
exports.normalizeCommitmentSchedule = normalizeCommitmentSchedule;
exports.getOpportunitySlots = getOpportunitySlots;
exports.getOpportunityStatusForSlot = getOpportunityStatusForSlot;
exports.getMomentumStatus = getMomentumStatus;
exports.getMomentumLabel = getMomentumLabel;
exports.calculateMomentumSummary = calculateMomentumSummary;
const commitments_1 = require("../shared/commitments");
function padDatePart(value) {
    return value.toString().padStart(2, '0');
}
function getLocalDateParts(timezone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: '2-digit',
        timeZone: timezone,
        weekday: 'short',
        year: 'numeric',
    }).formatToParts(now);
    return {
        day: Number(parts.find(part => part.type === 'day')?.value ?? '1'),
        month: Number(parts.find(part => part.type === 'month')?.value ?? '1'),
        weekday: parts.find(part => part.type === 'weekday')?.value ?? 'Mon',
        year: Number(parts.find(part => part.type === 'year')?.value ?? '1970'),
    };
}
function getDateKey(timezone, now = new Date()) {
    const local = getLocalDateParts(timezone, now);
    return [
        local.year,
        padDatePart(local.month),
        padDatePart(local.day),
    ].join('-');
}
function parseDateKey(dateKey) {
    const [year = '1970', month = '01', day = '01'] = dateKey.split('-');
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}
function formatDateKey(date) {
    return [
        date.getUTCFullYear(),
        padDatePart(date.getUTCMonth() + 1),
        padDatePart(date.getUTCDate()),
    ].join('-');
}
function addDays(dateKey, days) {
    const date = parseDateKey(dateKey);
    date.setUTCDate(date.getUTCDate() + days);
    return formatDateKey(date);
}
function getDaysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function getWeekStartDateKey(timezone, now = new Date()) {
    const local = getLocalDateParts(timezone, now);
    const dayOffsetByWeekday = {
        Fri: 4,
        Mon: 0,
        Sat: 5,
        Sun: 6,
        Thu: 3,
        Tue: 1,
        Wed: 2,
    };
    const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
    localDate.setUTCDate(localDate.getUTCDate() - (dayOffsetByWeekday[local.weekday] ?? 0));
    return formatDateKey(localDate);
}
function getPeriodShape(schedule, now = new Date()) {
    if (schedule.cadence === 'daily') {
        const dateKey = getDateKey(schedule.timezone, now);
        return { dayCount: 1, periodKey: dateKey, startDateKey: dateKey };
    }
    if (schedule.cadence === 'monthly') {
        const local = getLocalDateParts(schedule.timezone, now);
        const startDateKey = [
            local.year,
            padDatePart(local.month),
            '01',
        ].join('-');
        return {
            dayCount: getDaysInMonth(local.year, local.month),
            periodKey: `${local.year}-${padDatePart(local.month)}`,
            startDateKey,
        };
    }
    const startDateKey = getWeekStartDateKey(schedule.timezone, now);
    return {
        dayCount: 7,
        periodKey: startDateKey,
        startDateKey,
    };
}
function getSlotOffsets(dayCount, opportunitiesPerPeriod) {
    const count = Math.min(dayCount, Math.max(1, Math.round(opportunitiesPerPeriod)));
    return Array.from({ length: count }, (_, index) => Math.min(dayCount - 1, Math.floor((index * dayCount) / count)));
}
function normalizeCommitmentSchedule(commitment, fallbackTimezone = 'UTC') {
    const rawCadence = commitment?.commitmentCadence;
    const cadence = rawCadence === 'daily' ||
        rawCadence === 'weekly' ||
        rawCadence === 'monthly'
        ? rawCadence
        : typeof commitment?.commitmentFrequency?.tapInsPerWeek === 'number' &&
            commitment.commitmentFrequency.tapInsPerWeek >= 7
            ? 'daily'
            : 'weekly';
    const timezone = typeof commitment?.timezone === 'string' && commitment.timezone.trim()
        ? commitment.timezone.trim()
        : fallbackTimezone;
    const fallbackCount = cadence === 'daily'
        ? 1
        : cadence === 'monthly'
            ? 4
            : typeof commitment?.commitmentFrequency?.tapInsPerWeek === 'number'
                ? commitment.commitmentFrequency.tapInsPerWeek
                : 7;
    const opportunitiesPerPeriod = cadence === 'daily'
        ? 1
        : (0, commitments_1.clampOpportunitiesPerPeriod)(commitment?.commitmentFrequency?.opportunitiesPerPeriod ??
            commitment?.commitmentFrequency?.tapInsPerWeek, fallbackCount);
    return {
        cadence,
        opportunitiesPerPeriod,
        slotPolicy: 'scheduled_slots',
        timezone,
    };
}
function getOpportunitySlots(schedule, now = new Date()) {
    const period = getPeriodShape(schedule, now);
    const offsets = getSlotOffsets(period.dayCount, schedule.opportunitiesPerPeriod);
    return offsets.map((offset, index) => {
        const availableDateKey = addDays(period.startDateKey, offset);
        const nextOffset = offsets[index + 1];
        const expiresOffset = typeof nextOffset === 'number' ? nextOffset - 1 : period.dayCount - 1;
        return {
            availableDateKey,
            expiresDateKey: addDays(period.startDateKey, expiresOffset),
            periodKey: period.periodKey,
            slotIndex: index,
        };
    });
}
function getOpportunityStatusForSlot({ completionStatus, now = new Date(), slot, timezone, }) {
    if (completionStatus === 'completed' || completionStatus === 'skipped') {
        return completionStatus;
    }
    const todayDateKey = getDateKey(timezone, now);
    if (slot.availableDateKey > todayDateKey) {
        return 'upcoming';
    }
    if (slot.expiresDateKey < todayDateKey) {
        return 'missed';
    }
    return 'available';
}
function getMomentumStatus(percentage) {
    if (percentage <= 0) {
        return 'getting_started';
    }
    if (percentage <= 30) {
        return 'building_momentum';
    }
    if (percentage <= 70) {
        return 'strong_momentum';
    }
    return 'peak_momentum';
}
function getMomentumLabel(status) {
    if (status === 'peak_momentum') {
        return 'Peak';
    }
    if (status === 'strong_momentum') {
        return 'Strong';
    }
    if (status === 'building_momentum') {
        return 'Building';
    }
    return 'Getting Started';
}
function calculateMomentumSummary({ opportunities, periodKey, priorBestStreak = 0, }) {
    const availableOpportunities = opportunities.filter(opportunity => opportunity.status !== 'upcoming').length;
    const completedOpportunities = opportunities.filter(opportunity => opportunity.status === 'completed').length;
    const percentage = availableOpportunities > 0
        ? Math.round((completedOpportunities / availableOpportunities) * 100)
        : 0;
    let currentStreak = 0;
    let bestStreak = priorBestStreak;
    [...opportunities]
        .filter(opportunity => opportunity.status !== 'upcoming')
        .sort((left, right) => {
        const dateDelta = left.availableDateKey.localeCompare(right.availableDateKey);
        return dateDelta !== 0 ? dateDelta : left.slotIndex - right.slotIndex;
    })
        .forEach(opportunity => {
        if (opportunity.status === 'completed') {
            currentStreak += 1;
            bestStreak = Math.max(bestStreak, currentStreak);
            return;
        }
        if (opportunity.status === 'missed' ||
            opportunity.status === 'expired') {
            currentStreak = 0;
        }
    });
    const status = getMomentumStatus(percentage);
    return {
        availableOpportunities,
        bestStreak,
        completedOpportunities,
        currentStreak,
        label: getMomentumLabel(status),
        percentage,
        periodKey,
        status,
    };
}
