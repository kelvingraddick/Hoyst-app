"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthcheck = exports.joinCircle = exports.createCircle = exports.submitTapIn = exports.completeProfile = exports.notificationModules = exports.emailModules = void 0;
const https_1 = require("firebase-functions/v2/https");
var emails_1 = require("./emails");
Object.defineProperty(exports, "emailModules", { enumerable: true, get: function () { return emails_1.emailModules; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notificationModules", { enumerable: true, get: function () { return notifications_1.notificationModules; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "completeProfile", { enumerable: true, get: function () { return auth_1.completeProfile; } });
var checkins_1 = require("./checkins");
Object.defineProperty(exports, "submitTapIn", { enumerable: true, get: function () { return checkins_1.submitTapIn; } });
var circles_1 = require("./circles");
Object.defineProperty(exports, "createCircle", { enumerable: true, get: function () { return circles_1.createCircle; } });
Object.defineProperty(exports, "joinCircle", { enumerable: true, get: function () { return circles_1.joinCircle; } });
exports.healthcheck = (0, https_1.onRequest)((request, response) => {
    response.json({
        app: 'hoyst-functions',
        method: request.method,
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
