import React from 'react';
import {View} from 'react-native';
import {Trophy} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {DSButton, DSListRow, DSSurface, DSText} from '../../../design/system';
import type {RootStackParamList} from '../../../navigation/types';
import {
  ProfileIcon,
  ProfileScaffold,
  ProfileTheme,
} from '../components/ProfileScaffold';
import {useProfileOverview} from '../hooks/useProfileOverview';
import {getEarnedProfileMilestones} from '../services/profile-personalization';
type Props = NativeStackScreenProps<RootStackParamList, 'ProfileMilestones'>;
export function ProfileMilestonesScreen(props: Props) {
  return (
    <ProfileTheme>
      <Content {...props} />
    </ProfileTheme>
  );
}
function Content({navigation}: Props) {
  const overview = useProfileOverview();
  const earned = getEarnedProfileMilestones(overview.progress);
  return (
    <ProfileScaffold title="Earned milestones" onBack={navigation.goBack}>
      <DSText tone="muted">
        Your earned accomplishments stay with you, even when a streak starts
        again.
      </DSText>
      {overview.error ? (
        <View>
          <DSText tone="danger">{overview.error}</DSText>
          <DSButton
            label="Try again"
            variant="quiet"
            onPress={overview.refresh}
          />
        </View>
      ) : null}
      {!overview.progress ? (
        <DSText tone="muted">Loading earned milestones...</DSText>
      ) : !earned.length ? (
        <DSSurface>
          <DSText variant="heading">Your first milestone is ahead</DSText>
          <DSText tone="muted">
            Keep showing up. Earned milestones will appear here.
          </DSText>
        </DSSurface>
      ) : (
        <DSSurface>
          {earned.map(milestone => (
            <DSListRow
              key={milestone.id}
              title={milestone.label}
              subtitle={milestone.detail}
              leading={<ProfileIcon icon={Trophy} tone="gold" />}
              testID={`earned-${milestone.id}`}
            />
          ))}
        </DSSurface>
      )}
    </ProfileScaffold>
  );
}
