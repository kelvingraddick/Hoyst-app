"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthcheck = exports.rotateCircleInvite = exports.resolveCircleInvite = exports.invitePage = exports.toggleCircleThreadItemLike = exports.sendCircleThreadMessage = exports.markCircleThreadRead = exports.materializeMomentumOpportunities = exports.backfillMomentumOpportunities = exports.getProfileSummary = exports.generateHomeGreeting = exports.updateCircle = exports.unarchiveCircle = exports.reviewJoinRequest = exports.nudgeCircleMembers = exports.leaveCircle = exports.joinCircle = exports.deleteCircle = exports.createCircle = exports.convertPersonalCircle = exports.archiveCircle = exports.updateTapInDetails = exports.submitTapIn = exports.removeTapIn = exports.processTapInSideEffects = exports.deleteAccount = exports.completeProfile = exports.updateNotificationSettings = exports.sendRoutineEngagementNotifications = exports.sendMiddayTapInReminders = exports.sendFinalTapInWarnings = exports.sendEveningActivityRecaps = exports.repairPushSubscription = exports.notificationModules = exports.markInboxEventRead = exports.markInboxEventsRead = exports.emailModules = void 0;
const https_1 = require("firebase-functions/v2/https");
var emails_1 = require("./emails");
Object.defineProperty(exports, "emailModules", { enumerable: true, get: function () { return emails_1.emailModules; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "markInboxEventsRead", { enumerable: true, get: function () { return notifications_1.markInboxEventsRead; } });
Object.defineProperty(exports, "markInboxEventRead", { enumerable: true, get: function () { return notifications_1.markInboxEventRead; } });
Object.defineProperty(exports, "notificationModules", { enumerable: true, get: function () { return notifications_1.notificationModules; } });
Object.defineProperty(exports, "repairPushSubscription", { enumerable: true, get: function () { return notifications_1.repairPushSubscription; } });
Object.defineProperty(exports, "sendEveningActivityRecaps", { enumerable: true, get: function () { return notifications_1.sendEveningActivityRecaps; } });
Object.defineProperty(exports, "sendFinalTapInWarnings", { enumerable: true, get: function () { return notifications_1.sendFinalTapInWarnings; } });
Object.defineProperty(exports, "sendMiddayTapInReminders", { enumerable: true, get: function () { return notifications_1.sendMiddayTapInReminders; } });
Object.defineProperty(exports, "sendRoutineEngagementNotifications", { enumerable: true, get: function () { return notifications_1.sendRoutineEngagementNotifications; } });
Object.defineProperty(exports, "updateNotificationSettings", { enumerable: true, get: function () { return notifications_1.updateNotificationSettings; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "completeProfile", { enumerable: true, get: function () { return auth_1.completeProfile; } });
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return auth_1.deleteAccount; } });
var checkins_1 = require("./checkins");
Object.defineProperty(exports, "processTapInSideEffects", { enumerable: true, get: function () { return checkins_1.processTapInSideEffects; } });
Object.defineProperty(exports, "removeTapIn", { enumerable: true, get: function () { return checkins_1.removeTapIn; } });
Object.defineProperty(exports, "submitTapIn", { enumerable: true, get: function () { return checkins_1.submitTapIn; } });
Object.defineProperty(exports, "updateTapInDetails", { enumerable: true, get: function () { return checkins_1.updateTapInDetails; } });
var circles_1 = require("./circles");
Object.defineProperty(exports, "archiveCircle", { enumerable: true, get: function () { return circles_1.archiveCircle; } });
Object.defineProperty(exports, "convertPersonalCircle", { enumerable: true, get: function () { return circles_1.convertPersonalCircle; } });
Object.defineProperty(exports, "createCircle", { enumerable: true, get: function () { return circles_1.createCircle; } });
Object.defineProperty(exports, "deleteCircle", { enumerable: true, get: function () { return circles_1.deleteCircle; } });
Object.defineProperty(exports, "joinCircle", { enumerable: true, get: function () { return circles_1.joinCircle; } });
Object.defineProperty(exports, "leaveCircle", { enumerable: true, get: function () { return circles_1.leaveCircle; } });
Object.defineProperty(exports, "nudgeCircleMembers", { enumerable: true, get: function () { return circles_1.nudgeCircleMembers; } });
Object.defineProperty(exports, "reviewJoinRequest", { enumerable: true, get: function () { return circles_1.reviewJoinRequest; } });
Object.defineProperty(exports, "unarchiveCircle", { enumerable: true, get: function () { return circles_1.unarchiveCircle; } });
Object.defineProperty(exports, "updateCircle", { enumerable: true, get: function () { return circles_1.updateCircle; } });
var homeGreeting_1 = require("./homeGreeting");
Object.defineProperty(exports, "generateHomeGreeting", { enumerable: true, get: function () { return homeGreeting_1.generateHomeGreeting; } });
var profile_1 = require("./profile");
Object.defineProperty(exports, "getProfileSummary", { enumerable: true, get: function () { return profile_1.getProfileSummary; } });
var momentum_1 = require("./momentum");
Object.defineProperty(exports, "backfillMomentumOpportunities", { enumerable: true, get: function () { return momentum_1.backfillMomentumOpportunities; } });
Object.defineProperty(exports, "materializeMomentumOpportunities", { enumerable: true, get: function () { return momentum_1.materializeMomentumOpportunities; } });
var thread_1 = require("./thread");
Object.defineProperty(exports, "markCircleThreadRead", { enumerable: true, get: function () { return thread_1.markCircleThreadRead; } });
Object.defineProperty(exports, "sendCircleThreadMessage", { enumerable: true, get: function () { return thread_1.sendCircleThreadMessage; } });
Object.defineProperty(exports, "toggleCircleThreadItemLike", { enumerable: true, get: function () { return thread_1.toggleCircleThreadItemLike; } });
var invites_1 = require("./invites");
Object.defineProperty(exports, "invitePage", { enumerable: true, get: function () { return invites_1.invitePage; } });
Object.defineProperty(exports, "resolveCircleInvite", { enumerable: true, get: function () { return invites_1.resolveCircleInvite; } });
Object.defineProperty(exports, "rotateCircleInvite", { enumerable: true, get: function () { return invites_1.rotateCircleInvite; } });
exports.healthcheck = (0, https_1.onRequest)((request, response) => {
    response.json({
        app: 'hoyst-functions',
        method: request.method,
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
