"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPublicationOnlyUpdate = isPublicationOnlyUpdate;
const node_util_1 = require("node:util");
/** Public discovery migrations must not replay ordinary Tap In side effects. */
function isPublicationOnlyUpdate(before, after) {
    if (!before || !after) {
        return false;
    }
    const { publicTapIn: previousMarker, ...previousFields } = before;
    const { publicTapIn: nextMarker, ...nextFields } = after;
    return (!(0, node_util_1.isDeepStrictEqual)(previousMarker, nextMarker) &&
        (0, node_util_1.isDeepStrictEqual)(previousFields, nextFields));
}
