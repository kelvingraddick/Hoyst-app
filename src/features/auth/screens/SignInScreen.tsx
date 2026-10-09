import React, {useEffect, useRef, useState} from 'react';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type {
  AuthStackParamList,
  RootStackParamList,
} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {useOnboardingStore} from '../../../store/onboarding-store';
import {SetupJourneyFrame} from '../../create-circle/components/SetupJourneyFrame';
import {SetupAuthForm, type AuthFormState} from '../components/SetupAuthForm';
type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
export function SignInScreen({navigation, route}: Props): React.JSX.Element {
  const action = useRef<(() => void) | undefined>(undefined);
  const backAction = useRef<(() => boolean) | undefined>(undefined);
  const status = useSessionStore(state => state.status);
  const [form, setForm] = useState<AuthFormState>({
    title: 'Welcome back',
    message: 'Pick up where you left off.',
    emphasis: ['where you left off'],
    label: 'Choose a sign-in method',
    disabled: true,
    busy: false,
  });
  const root =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    if (status === 'authenticatedIncompleteProfile') {
      useOnboardingStore.getState().prepareProfileCompletion();
      navigation.navigate('Welcome', {setupKey: route.params?.setupKey});
    } else if (status === 'authenticatedReady') {
      const setup = useOnboardingStore.getState();
      if (
        setup.hasPendingProfileCompletion ||
        setup.hasPendingStarterCircleSetup ||
        setup.journey === 'invite'
      )
        navigation.navigate('Welcome', {setupKey: route.params?.setupKey});
      else {
        setup.markSeen();
        root?.navigate('MainTabs', {screen: 'Home'});
      }
    }
  }, [navigation, root, route.params?.setupKey, status]);
  return (
    <SetupJourneyFrame
      title={form.title}
      message={form.message}
      messageEmphasis={form.emphasis}
      step={form.title}
      onBack={() => {
        if (!form.busy && !backAction.current?.()) navigation.goBack();
      }}
      primary={
        form.method
          ? {
              label: form.label,
              disabled: form.disabled,
              onPress: () => action.current?.(),
            }
          : undefined
      }
      tertiary={{
        label: 'New to Hoyst? Get started',
        disabled: form.busy,
        onPress: () => {
          useOnboardingStore.getState().startOnboardingWizard();
          navigation.navigate('Welcome', {setupKey: route.params?.setupKey});
        },
      }}>
      <SetupAuthForm
        creating={false}
        backRef={backAction}
        actionRef={action}
        onState={setForm}
        initialMethod={route.params?.method}
      />
    </SetupJourneyFrame>
  );
}
