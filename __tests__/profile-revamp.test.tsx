import React from 'react';
import {Alert, Image, Pressable, Switch, Text, TextInput} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {EditProfileScreen} from '../src/features/settings/screens/EditProfileScreen';
import {
  NotificationSettingsScreen,
  SettingsScreen,
  AccountSettingsScreen,
} from '../src/features/settings/screens/SettingsScreens';
import {ProfileScreen} from '../src/features/profile/screens/ProfileScreen';
import {ProfileShareScreen} from '../src/features/profile/screens/ProfileShareScreen';
import {
  normalizeProfileTint,
  getEarnedProfileMilestones,
  profileShareMessage,
} from '../src/features/profile/services/profile-personalization';
import type {UserProfile} from '../src/types/models';

const mockAvailability = jest.fn();
const mockUpdate = jest.fn();
const mockUpload = jest.fn();
const mockDelete = jest.fn();
const mockSignOut = jest.fn();
const mockPermission = jest.fn();
const mockNotificationUpdate = jest.fn();
const mockSetProfile = jest.fn();
const mockSetPreference = jest.fn();
const mockShare = jest.fn();
let mockGuard: {enabled: boolean; callback: (data: unknown) => void};
let mockUid = 'user-1';
let mockProfile: UserProfile;
let mockOverview: Record<string, unknown>;
let mockDimensions = {width: 402, height: 874, scale: 3, fontScale: 1};
let mockNotifications = {
  tapInReminders: true,
  socialActivity: true,
  nudgePrompts: true,
  nudges: true,
  discovery: true,
  productUpdates: true,
};
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: require('react-native').View,
  useSafeAreaInsets: () => ({top: 62, bottom: 34, left: 0, right: 0}),
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (enabled: boolean, callback: () => void) => {
    mockGuard = {enabled, callback};
  },
}));
jest.mock('../src/store/profile-store', () => ({
  useUserProfileStore: Object.assign(
    (select: (value: unknown) => unknown) => select({profile: mockProfile}),
    {getState: () => ({profile: mockProfile, setProfile: mockSetProfile})},
  ),
}));
jest.mock('../src/store/session-store', () => ({
  useSessionStore: Object.assign(
    (select: (value: unknown) => unknown) => select({user: {uid: mockUid}}),
    {
      getState: () => ({
        user: {uid: mockUid},
        setGuest: jest.fn(),
        clearPendingAction: jest.fn(),
      }),
    },
  ),
}));
jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: Object.assign(
    (select: (value: unknown) => unknown) => select({appearance: 'light'}),
    {
      getState: () => ({
        setNotificationPreference: mockSetPreference,
        setNotificationSettings: jest.fn(),
        reset: jest.fn(),
      }),
    },
  ),
}));
jest.mock('../src/store/onboarding-store', () => ({
  useOnboardingStore: {
    getState: () => ({reset: jest.fn(), markSeen: jest.fn()}),
  },
}));
jest.mock('../src/features/auth/services/account-service', () => ({
  checkProfileUsername: (...args: unknown[]) => mockAvailability(...args),
  updateProfileFields: (...args: unknown[]) => mockUpdate(...args),
  uploadProfileAvatar: (...args: unknown[]) => mockUpload(...args),
  deleteAccount: () => mockDelete(),
}));
jest.mock('../src/features/auth/services/auth-service', () => ({
  signOutOfHoyst: () => mockSignOut(),
}));
jest.mock('../src/lib/notifications', () => ({
  requestPushNotificationPermission: () => mockPermission(),
}));
jest.mock(
  '../src/features/settings/services/notification-settings-service',
  () => ({
    subscribeToNotificationSettings: ({
      onSettings,
    }: {
      onSettings: (value: unknown) => void;
    }) => {
      onSettings(mockNotifications);
      return jest.fn();
    },
    updateNotificationSettings: (...args: unknown[]) =>
      mockNotificationUpdate(...args),
  }),
);
jest.mock('../src/features/settings/services/app-info', () => ({
  getInstalledAppInfo: () => ({version: '1.0', build: '45'}),
}));
jest.mock('../src/features/auth/components/TimezonePicker', () => ({
  TimezonePicker: ({onChange}: {onChange: (value: string) => void}) =>
    require('react').createElement(require('react-native').Pressable, {
      testID: 'test-timezone',
      onPress: () => onChange('Europe/London'),
    }),
}));
jest.mock('react-native-image-picker', () => ({launchImageLibrary: jest.fn()}));
jest.mock('../src/features/profile/hooks/useProfileOverview', () => ({
  useProfileOverview: () => mockOverview,
}));
jest.mock('../src/features/check-in/services/tap-in-story-share', () => ({
  shareTapInStoryImage: (...args: unknown[]) => mockShare(...args),
}));
let screen: renderer.ReactTestRenderer;
const navigation = {
  goBack: jest.fn(),
  dispatch: jest.fn(),
  navigate: jest.fn(),
  getParent: () => ({navigate: navigation.navigate}),
};
const mount = (Component: React.ComponentType<any>, params = {}) =>
  act(() => {
    screen = renderer.create(
      <Component navigation={navigation} route={{params}} />,
    );
  });
const input = (id: string) =>
  screen.root.findAllByType(TextInput).find(node => node.props.testID === id)!;
const button = (id: string) =>
  screen.root.findAllByType(Pressable).find(node => node.props.testID === id)!;
const text = () =>
  screen.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .flat(Infinity)
    .filter(value => typeof value === 'string' || typeof value === 'number')
    .join(' ');
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUid = 'user-1';
  mockProfile = {
    id: 'user-1',
    name: 'Kelvin',
    handle: 'kelvin',
    bio: 'Keeping steady.',
    timezone: 'UTC',
    onboardingStatus: 'complete',
  };
  mockDimensions = {width: 402, height: 874, scale: 3, fontScale: 1};
  mockAvailability.mockResolvedValue({handle: 'new_name', available: true});
  mockUpdate.mockResolvedValue({...mockProfile, handle: 'new_name'});
  mockPermission.mockResolvedValue(true);
  mockNotificationUpdate.mockResolvedValue({});
  mockDelete.mockResolvedValue({deleted: true});
  mockSignOut.mockResolvedValue(undefined);
  mockShare.mockResolvedValue({success: false});
  mockOverview = {
    profile: mockProfile,
    status: 'ready',
    stats: {
      personalStreakDays: 14,
      longestStreakDays: 28,
      totalTapIns: 186,
      activeCircleCount: 1,
      activePersonalCommitmentCount: 3,
    },
    progress: {
      totalXP: 340,
      level: 5,
      levelXP: 60,
      requiredXP: 70,
      flags: {earning: true},
      milestones: {streak_7: true},
    },
    momentumLabel: '86%',
    categories: ['fitness'],
    refresh: jest.fn(),
  };
});
afterEach(() => {
  act(() => screen?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('defaults missing tint and lists only saved milestone awards', () => {
  expect(normalizeProfileTint(undefined)).toBe('green');
  expect(normalizeProfileTint('red')).toBe('green');
  expect(normalizeProfileTint('purple')).toBe('purple');
  expect(
    getEarnedProfileMilestones({
      milestones: {streak_7: true, streak_30: false, unknown: true},
    }).map(item => item.id),
  ).toEqual(['streak_7']);
});
it('normalizes username checks, saves tint and identity, and retains the draft on a collision', async () => {
  mount(EditProfileScreen);
  act(() => {
    input('edit-profile-username').props.onChangeText(' @New_NAME ');
    button('profile-tint-purple').props.onPress();
  });
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(mockAvailability).toHaveBeenCalledWith('new_name');
  mockUpdate.mockRejectedValueOnce(
    new Error('That username is already taken.'),
  );
  await act(async () => {
    button('edit-profile-save').props.onPress();
  });
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({handle: 'new_name', profileTint: 'purple'}),
  );
  expect(input('edit-profile-username').props.value).toBe(' @New_NAME ');
  expect(text()).toContain('That username is already taken.');
  expect(navigation.goBack).not.toHaveBeenCalled();
  expect(mockSetProfile).not.toHaveBeenCalled();
  await act(async () => {
    button('edit-profile-save').props.onPress();
  });
  expect(mockSetProfile).toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
});
it('ignores an older availability response and confirms before discarding edits', async () => {
  let resolve!: (value: unknown) => void;
  mockAvailability.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  mount(EditProfileScreen);
  act(() => input('edit-profile-username').props.onChangeText('first_name'));
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  act(() => input('edit-profile-username').props.onChangeText('second_name'));
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  await act(async () => {
    resolve({available: false});
  });
  expect(text()).not.toContain('That username is already taken.');
  const alert = jest.spyOn(Alert, 'alert');
  expect(mockGuard.enabled).toBe(true);
  act(() => mockGuard.callback({data: {action: {type: 'GO_BACK'}}}));
  expect(alert).toHaveBeenCalledWith(
    'Discard changes?',
    expect.any(String),
    expect.any(Array),
  );
  expect(navigation.dispatch).not.toHaveBeenCalled();
});
it('retains a selected photo on save failure and uses a versioned upload', async () => {
  const {launchImageLibrary} = require('react-native-image-picker');
  launchImageLibrary.mockResolvedValue({assets: [{uri: 'file:///photo.jpg'}]});
  mockUpload.mockResolvedValue('https://example.com/new.jpg');
  mockUpdate.mockRejectedValueOnce(new Error('Offline'));
  mount(EditProfileScreen);
  await act(async () => {
    button('edit-profile-photo').props.onPress();
  });
  await act(async () => {
    button('edit-profile-save').props.onPress();
  });
  expect(mockUpload).toHaveBeenCalledWith({
    uid: 'user-1',
    uri: 'file:///photo.jpg',
    versioned: true,
  });
  expect(
    screen.root
      .findAllByType(Image)
      .some(node => node.props.source?.uri === 'file:///photo.jpg'),
  ).toBe(true);
  expect(text()).toContain('Offline');
});
it('does not apply an in-flight save to a switched account', async () => {
  let resolve!: (value: unknown) => void;
  mockUpdate.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  mount(EditProfileScreen);
  act(() => input('edit-profile-name').props.onChangeText('Updated'));
  await act(async () => {
    button('edit-profile-save').props.onPress();
  });
  mockUid = 'different';
  await act(async () => {
    resolve({...mockProfile, name: 'Updated'});
  });
  expect(mockSetProfile).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
});
it('rolls back a failed notification preference and retains all six controls', async () => {
  mockNotificationUpdate.mockRejectedValueOnce(new Error('Offline'));
  mount(NotificationSettingsScreen);
  expect(screen.root.findAllByType(Switch)).toHaveLength(6);
  await act(async () => {
    screen.root.findAllByType(Switch)[0].props.onValueChange(false);
  });
  expect(screen.root.findAllByType(Switch)[0].props.value).toBe(true);
  expect(mockSetPreference).toHaveBeenLastCalledWith('tapInReminders', true);
  expect(text()).toContain('Offline');
});
it('requires system permission before enabling notifications', async () => {
  mockNotifications = {...mockNotifications, tapInReminders: false};
  mockPermission.mockResolvedValueOnce(false);
  mount(NotificationSettingsScreen);
  await act(async () => {
    screen.root.findAllByType(Switch)[0].props.onValueChange(true);
  });
  expect(mockNotificationUpdate).not.toHaveBeenCalled();
  expect(screen.root.findAllByType(Switch)[0].props.value).toBe(false);
  expect(text()).toContain('Allow Hoyst notifications');
  mockNotifications = {...mockNotifications, tapInReminders: true};
});
it('routes profile actions and does not show missing data as zero', () => {
  mount(ProfileScreen);
  expect(button('profile-share').props.accessibilityLabel).toBe(
    'Share profile',
  );
  act(() => button('profile-share').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('ProfileShare');
  expect(button('profile-edit').props.accessibilityLabel).toBe('Edit profile');
  act(() => button('profile-edit').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('EditProfile');
  expect(button('profile-edit-photo').props.accessibilityLabel).toBe(
    'Edit profile photo',
  );
  act(() => button('profile-edit-photo').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('EditProfile', {
    focusPhoto: true,
  });
  act(() => button('profile-settings').props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('Settings');
  act(() => {
    screen.unmount();
  });
  mockOverview = {
    ...mockOverview,
    stats: undefined,
    progress: undefined,
    momentumLabel: undefined,
    error: 'Offline',
  };
  mount(ProfileScreen);
  expect(text()).not.toContain('0 Tap Ins');
  expect(text()).not.toContain('0 days');
  expect(text()).toContain('Offline');
});
it('waits for the avatar and complete data before exporting the preview invitation', async () => {
  mockProfile.avatarUrl = 'https://example.com/avatar.jpg';
  mount(ProfileShareScreen);
  expect(button('profile-share-export').props.accessibilityState.disabled).toBe(
    true,
  );
  act(() =>
    screen.root
      .findAllByType(Image)
      .find(node => node.props.source?.uri === mockProfile.avatarUrl)!
      .props.onLoadEnd(),
  );
  expect(button('profile-share-export').props.accessibilityState.disabled).toBe(
    false,
  );
  await act(async () => {
    button('profile-share-export').props.onPress();
  });
  expect(mockShare).toHaveBeenCalledWith(
    expect.anything(),
    profileShareMessage,
    expect.any(Function),
  );
});
it('uses current username for deletion and requires sign-out confirmation', async () => {
  mockProfile.handle = 'renamed';
  mount(SettingsScreen);
  const alert = jest.spyOn(Alert, 'alert');
  act(() => button('settings-sign-out').props.onPress());
  expect(mockSignOut).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith(
    'Sign out?',
    expect.any(String),
    expect.any(Array),
  );
  act(() => button('settings-delete-account').props.onPress());
  act(() => input('delete-account-username').props.onChangeText('kelvin'));
  expect(
    button('delete-account-confirm').props.accessibilityState.disabled,
  ).toBe(true);
  act(() => input('delete-account-username').props.onChangeText('@renamed'));
  expect(
    button('delete-account-confirm').props.accessibilityState.disabled,
  ).toBe(false);
  await act(async () => button('delete-account-confirm').props.onPress());
  expect(mockDelete).toHaveBeenCalledTimes(1);
});

it('saves timezone through the account callable and keeps a failed selection', async () => {
  mount(AccountSettingsScreen);
  act(() => button('test-timezone').props.onPress());
  mockUpdate.mockRejectedValueOnce(new Error('Timezone save failed'));
  await act(async () =>
    screen.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Save timezone')!
      .props.onPress(),
  );
  expect(mockUpdate).toHaveBeenCalledWith({timezone: 'Europe/London'});
  expect(text()).toContain('Timezone save failed');
  expect(mockSetProfile).not.toHaveBeenCalled();
});

it('targets the photo picker from the pencil and leaves the form unchanged on cancellation', async () => {
  const {launchImageLibrary} = require('react-native-image-picker');
  launchImageLibrary.mockResolvedValue({didCancel: true});
  mount(EditProfileScreen, {focusPhoto: true});
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(launchImageLibrary).toHaveBeenCalledTimes(1);
  expect(input('edit-profile-name').props.value).toBe('Kelvin');
  expect(button('edit-profile-save').props.accessibilityState.disabled).toBe(
    true,
  );
  expect(mockUpdate).not.toHaveBeenCalled();
});
it('retries an availability failure without clearing the username draft', async () => {
  mockAvailability.mockRejectedValueOnce(new Error('Availability offline'));
  mount(EditProfileScreen);
  act(() => input('edit-profile-username').props.onChangeText('new_name'));
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(button('edit-profile-save').props.accessibilityState.disabled).toBe(
    true,
  );
  act(() =>
    screen.root
      .findAllByType(Pressable)
      .find(node => node.props.accessibilityLabel === 'Check username again')!
      .props.onPress(),
  );
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(input('edit-profile-username').props.value).toBe('new_name');
  expect(button('edit-profile-save').props.accessibilityState.disabled).toBe(
    false,
  );
  expect(mockAvailability).toHaveBeenCalledTimes(2);
});
