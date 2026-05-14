import {onRequest} from 'firebase-functions/v2/https';

export {emailModules} from './emails';
export {
  markInboxEventRead,
  notificationModules,
  sendFinalTapInWarnings,
  sendMiddayTapInReminders,
  updateNotificationSettings,
} from './notifications';
export {completeProfile, deleteAccount} from './auth';
export {removeTapIn, submitTapIn} from './checkins';
export {
  createCircle,
  deleteCircle,
  joinCircle,
  pokeCircleMembers,
  reviewJoinRequest,
} from './circles';
export {getProfileSummary} from './profile';

export const healthcheck = onRequest((request, response) => {
  response.json({
    app: 'hoyst-functions',
    method: request.method,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
