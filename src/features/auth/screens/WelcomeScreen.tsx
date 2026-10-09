import React from 'react';
import type {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import type {
  AuthStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {CommitmentWizardScreen} from '../../create-circle/screens/CommitmentWizardScreen';
type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;
export function WelcomeScreen({navigation, route}: Props): React.JSX.Element {
  const root =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <CommitmentWizardScreen
      entry="onboarding"
      navigation={
        root ??
        (navigation as unknown as NativeStackNavigationProp<RootStackParamList>)
      }
      setupKey={route.params?.setupKey}
      onSignIn={() =>
        navigation.navigate('SignIn', {
          entryPoint: 'welcome',
          setupKey: route.params?.setupKey,
        })
      }
    />
  );
}
