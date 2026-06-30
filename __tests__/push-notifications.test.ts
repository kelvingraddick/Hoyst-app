function loadNotificationsModule({
  canRequestPermission = false,
  hasPermission = true,
  oneSignalAppId = 'test-onesignal-app-id',
  permissionRequestGranted = hasPermission,
  pushToken = 'push-token',
  subscriptionId = 'subscription-id',
}: {
  canRequestPermission?: boolean;
  hasPermission?: boolean;
  oneSignalAppId?: string;
  permissionRequestGranted?: boolean;
  pushToken?: string;
  subscriptionId?: string;
} = {}) {
  jest.resetModules();

  const mockRepairPushSubscription = jest
    .fn()
    .mockResolvedValue({data: {repaired: false, status: 'already-enabled'}});
  const mockHttpsCallable = jest.fn(() => mockRepairPushSubscription);
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
        getIdAsync: jest.fn().mockResolvedValue(subscriptionId),
        getOptedInAsync: jest.fn().mockResolvedValue(hasPermission),
        getTokenAsync: jest.fn().mockResolvedValue(pushToken),
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
  jest.doMock('../src/lib/firebase/functions', () => ({
    firebaseFunctions: jest.fn(() => ({
      httpsCallable: mockHttpsCallable,
    })),
  }));

  return {
    mockHttpsCallable,
    mockOneSignal,
    mockRepairPushSubscription,
    notifications: require('../src/lib/notifications'),
  };
}

describe('push notification subscription repair', () => {
  afterEach(() => {
    jest.dontMock('react-native-onesignal');
    jest.dontMock('react-native-config');
    jest.dontMock('../src/lib/firebase/functions');
  });

  it('logs in and opts into OneSignal when the device already has OS permission', async () => {
    const {mockOneSignal, mockRepairPushSubscription, notifications} =
      loadNotificationsModule({
        hasPermission: true,
      });

    await notifications.identifyPushUser('user-1');

    expect(mockOneSignal.initialize).toHaveBeenCalledWith(
      'test-onesignal-app-id',
    );
    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.Notifications.getPermissionAsync).toHaveBeenCalled();
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
    expect(mockRepairPushSubscription).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      token: 'push-token',
    });
  });

  it('does not opt in during login when OS permission is not granted', async () => {
    const {mockOneSignal, mockRepairPushSubscription, notifications} =
      loadNotificationsModule({
        hasPermission: false,
      });

    await notifications.identifyPushUser('user-1');

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.User.pushSubscription.optIn).not.toHaveBeenCalled();
    expect(mockOneSignal.Notifications.requestPermission).not.toHaveBeenCalled();
    expect(mockRepairPushSubscription).not.toHaveBeenCalled();
  });

  it('requests OS permission during login repair when iOS can still prompt', async () => {
    const {mockOneSignal, mockRepairPushSubscription, notifications} =
      loadNotificationsModule({
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
    expect(mockRepairPushSubscription).toHaveBeenCalledWith({
      subscriptionId: 'subscription-id',
      token: 'push-token',
    });
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
    const {mockOneSignal, mockRepairPushSubscription, notifications} =
      loadNotificationsModule({
        hasPermission: true,
      });

    await notifications.identifyPushUser('user-1');
    mockOneSignal.login.mockClear();
    mockOneSignal.User.pushSubscription.optIn.mockClear();
    mockRepairPushSubscription.mockClear();

    await expect(notifications.syncPushSubscription()).resolves.toBe(true);

    expect(mockOneSignal.login).toHaveBeenCalledWith('user-1');
    expect(mockOneSignal.User.pushSubscription.optIn).toHaveBeenCalledTimes(1);
    expect(mockRepairPushSubscription).not.toHaveBeenCalled();
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
