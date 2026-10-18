"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readProofRequirement = readProofRequirement;
exports.getTapInProofRequirement = getTapInProofRequirement;
function readProofRequirement(value) {
    return value === 'photo' ? 'photo' : 'none';
}
function getTapInProofRequirement(circle, existingTapIn) {
    return readProofRequirement(existingTapIn ? existingTapIn.proofRequirement : circle.proofRequirement);
}
