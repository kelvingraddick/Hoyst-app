import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

export type AppearancePreference = 'dark' | 'system' | 'light';

type SettingsState = {
  appearance: AppearancePreference;
  notifications: {
    circleActivity: boolean;
    productUpdates: boolean;
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
  circleActivity: true,
  productUpdates: true,
  tapInReminders: true,
};

const defaultAppearance: AppearancePreference = 'dark';

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
      name: 'hoyst-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
