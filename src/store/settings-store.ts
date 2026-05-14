import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

type SettingsState = {
  notifications: {
    circleActivity: boolean;
    productUpdates: boolean;
    tapInReminders: boolean;
  };
  reset: () => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      notifications: defaultNotifications,
      reset: () => set({notifications: defaultNotifications}),
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
