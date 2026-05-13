"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveStarterCircleDecision = resolveStarterCircleDecision;
function resolveStarterCircleDecision({ existingCircleId, existingCircleIsValid, existingSetupId, hasStarterCirclePayload, setupId, }) {
    if (!hasStarterCirclePayload || !setupId) {
        return 'skip';
    }
    if (existingSetupId === setupId && existingCircleId) {
        return existingCircleIsValid ? 'reuse' : 'repair';
    }
    return 'create';
}
