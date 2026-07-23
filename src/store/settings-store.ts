import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

export type AppearancePreference = 'dark' | 'system' | 'light';

type SettingsState = {
  appearance: AppearancePreference;
  notifications: {
    discovery: boolean;
    nudgePrompts: boolean;
    nudges: boolean;
    productUpdates: boolean;
    socialActivity: boolean;
    tapInReminders: boolean;
  };
  reset: () => void;
  setAppearancePreference: (appearance: AppearancePreference) => void;
  setNotificationSettings: (
    notificationSettings: Partial<SettingsState['notifications']>,
  ) => void;
  setNotificationPreference: (
    key: keyof SettingsState['notifications'],
    value: boolean,
  ) => void;
};

const defaultNotifications = {
  discovery: true,
  nudgePrompts: true,
  nudges: true,
  productUpdates: true,
  socialActivity: true,
  tapInReminders: true,
};

const defaultAppearance: AppearancePreference = 'dark';

function normalizePersistedNotifications(
  value: unknown,
): SettingsState['notifications'] {
  const data =
    value && typeof value === 'object'
      ? (value as Partial<SettingsState['notifications']> & {
          circleRisk?: unknown;
          circleActivity?: unknown;
        })
      : {};
  const legacyCircleActivity =
    typeof data.circleActivity === 'boolean' ? data.circleActivity : true;
  const productUpdates =
    typeof data.productUpdates === 'boolean'
      ? data.productUpdates
      : defaultNotifications.productUpdates;

  return {
    discovery:
      typeof data.discovery === 'boolean' ? data.discovery : productUpdates,
    nudgePrompts:
      typeof data.nudgePrompts === 'boolean'
        ? data.nudgePrompts
        : typeof data.circleRisk === 'boolean'
          ? data.circleRisk
          : legacyCircleActivity,
    nudges:
      typeof data.nudges === 'boolean' ? data.nudges : legacyCircleActivity,
    productUpdates,
    socialActivity:
      typeof data.socialActivity === 'boolean'
        ? data.socialActivity
        : legacyCircleActivity,
    tapInReminders:
      typeof data.tapInReminders === 'boolean'
        ? data.tapInReminders
        : defaultNotifications.tapInReminders,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      appearance: defaultAppearance,
      notifications: defaultNotifications,
      reset: () =>
        set({
          appearance: defaultAppearance,
          notifications: defaultNotifications,
        }),
      setAppearancePreference: appearance => set({appearance}),
      setNotificationSettings: notificationSettings =>
        set(state => ({
          notifications: {
            ...state.notifications,
            ...notificationSettings,
          },
        })),
      setNotificationPreference: (key, value) =>
        set(state => ({
          notifications: {
            ...state.notifications,
            [key]: value,
          },
        })),
    }),
    {
      merge: (persisted, current) => {
        const persistedState =
          persisted && typeof persisted === 'object'
            ? (persisted as Partial<SettingsState>)
            : {};

        return {
          ...current,
          ...persistedState,
          notifications: normalizePersistedNotifications(
            persistedState.notifications,
          ),
        };
      },
      name: 'hoyst-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
