import {onRequest} from 'firebase-functions/v2/https';

export {authModules} from './auth';
export {checkInModules} from './checkins';
export {circleModules} from './circles';
export {emailModules} from './emails';
export {notificationModules} from './notifications';

export const healthcheck = onRequest((request, response) => {
  response.json({
    app: 'hoyst-functions',
    method: request.method,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});
