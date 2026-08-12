"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legacyCircleActivityFeedCategory = exports.legacyCircleActivityNotificationTypes = void 0;
/**
 * Persisted notification types and dedupe identifiers shipped before Circle
 * participants were standardized as Members. Keep these wire values stable.
 */
exports.legacyCircleActivityNotificationTypes = {
    achievementUnlocked: 'companion_achievement_unlocked',
    circleCreated: 'companion_circle_created',
    circleJoined: 'companion_circle_joined',
    momentumLevelUp: 'companion_momentum_level_up',
    skipped: 'companion_skipped',
    streakMilestone: 'companion_streak_milestone',
    tappedIn: 'companion_tapped_in',
};
exports.legacyCircleActivityFeedCategory = 'companion';
