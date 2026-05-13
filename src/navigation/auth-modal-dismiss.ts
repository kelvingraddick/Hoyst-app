import {CommonActions} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {getStateWithoutAuthModal} from './auth-modal-state';
import type {RootStackParamList} from './types';

export function dismissAuthModals(
  navigation?: NativeStackNavigationProp<RootStackParamList>,
) {
  if (!navigation) {
    return;
  }

  if (!getStateWithoutAuthModal(navigation.getState())) {
    return;
  }

  navigation.dispatch(currentState =>
    CommonActions.reset(
      getStateWithoutAuthModal(currentState) ?? currentState,
    ),
  );
}
