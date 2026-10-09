import React from 'react';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../../navigation/types';
import {CommitmentWizardScreen} from './CommitmentWizardScreen';
type Props = NativeStackScreenProps<RootStackParamList, 'CreateCircle'>;
export function CreateCircleScreen({navigation}: Props): React.JSX.Element {
  return <CommitmentWizardScreen entry="create" navigation={navigation} />;
}
