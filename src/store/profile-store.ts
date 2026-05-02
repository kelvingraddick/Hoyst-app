import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';

import {currentUserProfile} from '../features/circles/mockData';
import type {UserProfile} from '../types/models';

type EditableProfileFields = Pick<UserProfile, 'bio' | 'handle' | 'name'>;

type UserProfileState = {
  profile: UserProfile;
  updateProfile: (updates: EditableProfileFields) => void;
};

export const useUserProfileStore = create<UserProfileState>()(
  persist(
    set => ({
      profile: currentUserProfile,
      updateProfile: updates =>
        set(state => ({
          profile: {
            ...state.profile,
            ...updates,
            bio:
              updates.bio === undefined
                ? state.profile.bio
                : updates.bio.trim()
                  ? updates.bio.trim()
                  : undefined,
            handle: updates.handle.trim().replace(/^@+/, ''),
            name: updates.name.trim(),
          },
        })),
    }),
    {
      name: 'hoyst-user-profile',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
