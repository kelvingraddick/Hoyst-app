import {createContext, useContext} from 'react';
import type {UserProfile} from '../../../types/models';
import type {ProfileSummary} from '../services/profile-summary-service';
import type {ProgressSummary} from '../../progress/services/progress-service';
export type ProfilePreviewData = {
  scheme: 'light' | 'dark';
  status?: 'guest' | 'incomplete' | 'loading' | 'error';
  profile?: UserProfile;
  stats?: ProfileSummary;
  progress?: ProgressSummary;
  momentumLabel?: string;
  categories?: string[];
  captureBottom?: boolean;
  viewportWidth?: number;
  updateProfile?: (profile: UserProfile) => void;
};
export const ProfilePreviewContext = createContext<
  ProfilePreviewData | undefined
>(undefined);
export const useProfilePreview = () => useContext(ProfilePreviewContext);
