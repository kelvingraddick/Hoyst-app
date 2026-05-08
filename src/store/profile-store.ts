import {create} from 'zustand';

import type {UserProfile} from '../types/models';

type EditableProfileFields = Pick<UserProfile, 'avatarUrl' | 'bio' | 'name'>;

type UserProfileState = {
  profile?: UserProfile;
  setProfile: (profile?: UserProfile) => void;
  updateProfile: (updates: EditableProfileFields) => void;
};

export const useUserProfileStore = create<UserProfileState>(set => ({
  profile: undefined,
  setProfile: profile => set({profile}),
  updateProfile: updates =>
    set(state => {
      if (!state.profile) {
        return state;
      }

      return {
        profile: {
          ...state.profile,
          ...updates,
          bio:
            updates.bio === undefined
              ? state.profile.bio
              : updates.bio.trim()
                ? updates.bio.trim()
                : undefined,
          name: updates.name.trim(),
        },
      };
    }),
}));
