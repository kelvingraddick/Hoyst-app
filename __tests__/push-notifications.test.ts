function loadNotificationsModule({
  canRequestPermission = false,
  hasPermission = true,
  oneSignalAppId = 'test-onesignal-app-id',
  permissionRequestGranted = hasPermission,
}: {
  canRequestPermission?: boolean;
  hasPermission?: boolean;
  oneSignalAppId?: string;
  permissionRequestGranted?: boolean;
} = {}) {
  jest.resetModules();

  const mockOneSignal = {
    Debug: {
      setLogLevel: jest.fn(),
    },
    Notifications: {
      addEventListener: jest.fn(),
      canRequestPermission: jest.fn().mockResolvedValue(canRequestPermission),
      clearAll: jest.fn(),
      getPermissionAsync: jest.fn().mockResolvedValue(hasPermission),
      permissionNative: jest.fn().mockResolvedValue(2),
      requestPermission: jest.fn().mockResolvedValue(permissionRequestGranted),
    },
    User: {
      pushSubscription: {
        getIdAsync: jest.fn().mockResolvedValue('subscription-id'),
        getOptedInAsync: jest.fn().mockResolvedValue(hasPermission),
        getTokenAsync: jest.fn().mockResolvedValue('push-token'),
        optIn: jest.fn(),
      },
    },
    initialize: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };

  jest.doMock('react-native-onesignal', () => ({
    LogLevel: {Warn: 'Warn'},
    OneSignal: mockOneSignal,
  }));
  jest.doMock('react-native-config', () => ({
    __esModule: true,
    default: {
      ONESIGNAL_APP_ID: oneSignalAppId,
    },
  }));

  return {
    mockOneSignal,
    notifications: require('../src/lib/notifications'),
  };
}

describe('push notification subscription repair', () => {
  afterEach(() => {
    jest.dontMock('react-native-onesignal');
    jest.dontMock('react-native-config');
  });

  it('logs in and opts into OneSignal when the device already has OS permission', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      hasPermission: true,
    });

    await notifications.identifyPushUser('user-1');

    expect(mockOneSignal.initialize).toHaveBeenCalledWith(
      'test-onesignal-app-id',
    );
    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.Notifications.getPermissionAsync).toHaveBeenCalled();
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
  });

  it('does not opt in during login when OS permission is not granted', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      hasPermission: false,
    });

    await notifications.identifyPushUser('user-1');

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.User.pushSubscription.optIn).not.toHaveBeenCalled();
    expect(mockOneSignal.Notifications.requestPermission).not.toHaveBeenCalled();
  });

  it('requests OS permission during login repair when iOS can still prompt', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      canRequestPermission: true,
      hasPermission: false,
      permissionRequestGranted: true,
    });

    await notifications.identifyPushUser('user-1');

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.Notifications.requestPermission).toHaveBeenCalledWith(
      true,
    );
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
  });

  it('reuses the same quiet opt-in repair when permission is requested later', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      hasPermission: true,
    });

    await expect(
      notifications.requestPushNotificationPermission(),
    ).resolves.toBe(true);

    expect(
      mockOneSignal.Notifications.requestPermission,
    ).not.toHaveBeenCalled();
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
  });

  it('repairs the subscription when the app explicitly syncs an identified user', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      hasPermission: true,
    });

    await notifications.identifyPushUser('user-1');
    mockOneSignal.login.mockClear();
    mockOneSignal.User.pushSubscription.optIn.mockClear();

    await expect(notifications.syncPushSubscription()).resolves.toBe(true);

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
  });

  it('registers a OneSignal permission change repair listener', async () => {
    const {mockOneSignal, notifications} = loadNotificationsModule({
      hasPermission: true,
    });

    await notifications.identifyPushUser('user-1');

    const permissionListener =
      mockOneSignal.Notifications.addEventListener.mock.calls.find(
        ([eventName]) => eventName === 'permissionChange',
      )?.[1];

    expect(permissionListener).toEqual(expect.any(Function));

    mockOneSignal.login.mockClear();
    mockOneSignal.User.pushSubscription.optIn.mockClear();
    permissionListener(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
  });
});
