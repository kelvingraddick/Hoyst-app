"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhook = verifyWebhook;
const node_crypto_1 = require("node:crypto");
function verifyWebhook(raw, header, secret, now = Date.now()) {
    const timestamp = header.match(/(?:^|,)\s*t=(\d+)/)?.[1];
    const signatures = Array.from(header.matchAll(/(?:^|,)\s*v1=([a-f0-9]{64})/gi), match => match[1]);
    if (!timestamp || Math.abs(now / 1000 - Number(timestamp)) > 300 || !secret) {
        return false;
    }
    const expected = (0, node_crypto_1.createHmac)('sha256', secret)
        .update(timestamp + '.')
        .update(raw)
        .digest();
    return signatures.some(signature => (0, node_crypto_1.timingSafeEqual)(Buffer.from(signature, 'hex'), expected));
}
