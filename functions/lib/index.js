"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthcheck = exports.materializeMomentumOpportunities = exports.backfillMomentumOpportunities = exports.getProfileSummary = exports.generateHomeGreeting = exports.updateCircle = exports.reviewJoinRequest = exports.nudgeCircleMembers = exports.leaveCircle = exports.joinCircle = exports.deleteCircle = exports.createCircle = exports.submitTapIn = exports.removeTapIn = exports.deleteAccount = exports.completeProfile = exports.updateNotificationSettings = exports.sendMiddayTapInReminders = exports.sendFinalTapInWarnings = exports.notificationModules = exports.markInboxEventRead = exports.markInboxEventsRead = exports.emailModules = void 0;
const https_1 = require("firebase-functions/v2/https");
var emails_1 = require("./emails");
Object.defineProperty(exports, "emailModules", { enumerable: true, get: function () { return emails_1.emailModules; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "markInboxEventsRead", { enumerable: true, get: function () { return notifications_1.markInboxEventsRead; } });
Object.defineProperty(exports, "markInboxEventRead", { enumerable: true, get: function () { return notifications_1.markInboxEventRead; } });
Object.defineProperty(exports, "notificationModules", { enumerable: true, get: function () { return notifications_1.notificationModules; } });
Object.defineProperty(exports, "sendFinalTapInWarnings", { enumerable: true, get: function () { return notifications_1.sendFinalTapInWarnings; } });
Object.defineProperty(exports, "sendMiddayTapInReminders", { enumerable: true, get: function () { return notifications_1.sendMiddayTapInReminders; } });
Object.defineProperty(exports, "updateNotificationSettings", { enumerable: true, get: function () { return notifications_1.updateNotificationSettings; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "completeProfile", { enumerable: true, get: function () { return auth_1.completeProfile; } });
Object.defineProperty(exports, "deleteAccount", { enumerable: true, get: function () { return auth_1.deleteAccount; } });
var checkins_1 = require("./checkins");
Object.defineProperty(exports, "removeTapIn", { enumerable: true, get: function () { return checkins_1.removeTapIn; } });
Object.defineProperty(exports, "submitTapIn", { enumerable: true, get: function () { return checkins_1.submitTapIn; } });
var circles_1 = require("./circles");
Object.defineProperty(exports, "createCircle", { enumerable: true, get: function () { return circles_1.createCircle; } });
Object.defineProperty(exports, "deleteCircle", { enumerable: true, get: function () { return circles_1.deleteCircle; } });
Object.defineProperty(exports, "joinCircle", { enumerable: true, get: function () { return circles_1.joinCircle; } });
Object.defineProperty(exports, "leaveCircle", { enumerable: true, get: function () { return circles_1.leaveCircle; } });
Object.defineProperty(exports, "nudgeCircleMembers", { enumerable: true, get: function () { return circles_1.nudgeCircleMembers; } });
Object.defineProperty(exports, "reviewJoinRequest", { enumerable: true, get: function () { return circles_1.reviewJoinRequest; } });
Object.defineProperty(exports, "updateCircle", { enumerable: true, get: function () { return circles_1.updateCircle; } });
var homeGreeting_1 = require("./homeGreeting");
Object.defineProperty(exports, "generateHomeGreeting", { enumerable: true, get: function () { return homeGreeting_1.generateHomeGreeting; } });
var profile_1 = require("./profile");
Object.defineProperty(exports, "getProfileSummary", { enumerable: true, get: function () { return profile_1.getProfileSummary; } });
var momentum_1 = require("./momentum");
Object.defineProperty(exports, "backfillMomentumOpportunities", { enumerable: true, get: function () { return momentum_1.backfillMomentumOpportunities; } });
Object.defineProperty(exports, "materializeMomentumOpportunities", { enumerable: true, get: function () { return momentum_1.materializeMomentumOpportunities; } });
exports.healthcheck = (0, https_1.onRequest)((request, response) => {
    response.json({
        app: 'hoyst-functions',
        method: request.method,
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
