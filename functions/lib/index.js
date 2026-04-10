"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthcheck = exports.notificationModules = exports.emailModules = exports.circleModules = exports.checkInModules = exports.authModules = void 0;
const https_1 = require("firebase-functions/v2/https");
var auth_1 = require("./auth");
Object.defineProperty(exports, "authModules", { enumerable: true, get: function () { return auth_1.authModules; } });
var checkins_1 = require("./checkins");
Object.defineProperty(exports, "checkInModules", { enumerable: true, get: function () { return checkins_1.checkInModules; } });
var circles_1 = require("./circles");
Object.defineProperty(exports, "circleModules", { enumerable: true, get: function () { return circles_1.circleModules; } });
var emails_1 = require("./emails");
Object.defineProperty(exports, "emailModules", { enumerable: true, get: function () { return emails_1.emailModules; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notificationModules", { enumerable: true, get: function () { return notifications_1.notificationModules; } });
exports.healthcheck = (0, https_1.onRequest)((request, response) => {
    response.json({
        app: 'hoyst-functions',
        method: request.method,
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});
