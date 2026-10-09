import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../navigation/types';
import {CommitmentWizardScreen} from '../../create-circle/screens/CommitmentWizardScreen';
type Props = NativeStackScreenProps<RootStackParamList, 'CircleInvite'>;
export function CircleInviteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  return (
    <CommitmentWizardScreen
      entry="invite"
      navigation={navigation}
      setupKey={`invite:${route.params.inviteCode}`}
      inviteCode={route.params.inviteCode}
    />
  );
}
