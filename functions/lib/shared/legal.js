"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGAL_VERSION = void 0;
exports.hasCurrentLegalAcceptance = hasCurrentLegalAcceptance;
// Version identifiers are independent of the publication/effective date.
exports.LEGAL_VERSION = '2026-10-17';
function hasCurrentLegalAcceptance(value) {
    const record = value;
    return (record?.adult === true &&
        record.termsVersion === exports.LEGAL_VERSION &&
        record.privacyVersion === exports.LEGAL_VERSION &&
        Boolean(record.acceptedAt));
}
