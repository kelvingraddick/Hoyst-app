import {onRequest} from 'firebase-functions/v2/https';

export {emailModules} from './emails';
export {
  markInboxEventsRead,
  markInboxEventRead,
  notificationModules,
  repairPushSubscription,
  sendEveningActivityRecaps,
  sendFinalTapInWarnings,
  sendMiddayTapInReminders,
  sendRoutineEngagementNotifications,
  updateNotificationSettings,
} from './notifications';
export {completeProfile, deleteAccount} from './auth';
export {processTapInSideEffects, removeTapIn, submitTapIn} from './checkins';
export {
  createCircle,
  deleteCircle,
  joinCircle,
  leaveCircle,
  nudgeCircleMembers,
  reviewJoinRequest,
  updateCircle,
} from './circles';
export {generateHomeGreeting} from './homeGreeting';
export {getProfileSummary} from './profile';
export {
  backfillMomentumOpportunities,
  materializeMomentumOpportunities,
} from './momentum';
export {
  markCircleThreadRead,
  sendCircleThreadMessage,
  toggleCircleThreadItemLike,
} from './thread';

export const healthcheck = onRequest((request, response) => {
  response.json({
    app: 'hoyst-functions',
    method: request.method,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
