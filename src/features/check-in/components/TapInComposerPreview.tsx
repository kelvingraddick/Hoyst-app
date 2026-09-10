/** Developer-only native fixtures. All actions stay in local React state. */
import React, {useState} from 'react';
import {
  ScrollView,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import {useSettingsStore} from '../../../store/settings-store';
import {
  NavigationContainer,
  NavigationIndependentTree,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  DesignSystemProvider,
  DSButton,
  DSFeedback,
  DSSurface,
  DSText,
} from '../../../design/system';
import {getTapInComposerScreenOptions} from '../../../navigation/tap-in-sheet-options';
import type {CircleDetailModel} from '../../../types/models';
import {
  ComposerAction,
  ComposerHeader,
  ComposerPhoto,
  ComposerQuantity,
  ComposerQuietAction,
  ComposerSheet,
  composerStyles,
} from './TapInComposerPresentation';
import {ComposerDetailsPresentation} from './TapInDetailsSection';

type Mode =
  | 'Simple'
  | 'Avoid'
  | 'Build'
  | 'Limit'
  | 'Range'
  | 'Saved'
  | 'Skipped'
  | 'Photo'
  | 'Editor'
  | 'Loading'
  | 'Error'
  | 'Busy'
  | 'Long';
type Routes = {Menu: undefined; Sheet: {mode: Mode; dark: boolean}};
const Stack = createNativeStackNavigator<Routes>();
const modes: Mode[] = [
  'Simple',
  'Avoid',
  'Build',
  'Limit',
  'Range',
  'Saved',
  'Skipped',
  'Photo',
  'Editor',
  'Loading',
  'Error',
  'Busy',
  'Long',
];
const photo =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNo2HmSJMQwqmFUw/DVAAD4HgIf0RZVtwAAAABJRU5ErkJggg==';

function Fixture({route, navigation}: NativeStackScreenProps<Routes, 'Sheet'>) {
  const {mode, dark} = route.params;
  const [value, setValue] = useState(
    mode === 'Limit'
      ? 2
      : mode === 'Range'
      ? 1
      : mode === 'Long'
      ? 123456789
      : 20,
  );
  const [uri, setUri] = useState<string | undefined>(
    mode === 'Photo' ? photo : undefined,
  );
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(mode === 'Editor');
  const [saved, setSaved] = useState(mode === 'Saved');
  const quantity = ['Build', 'Limit', 'Range', 'Saved', 'Long'].includes(mode);
  const detail = {
    members: [],
    activity: [],
    monthProgress: [],
    commitmentLabel: 'Preview commitment',
    completionRate: 0,
    memberCount: 1,
    maxSize: 8,
    id: 'local-preview',
    title:
      mode === 'Long'
        ? 'Building a lasting daily practice with my Circle, even on the busiest days'
        : quantity
        ? mode === 'Limit' || mode === 'Range'
          ? 'Mindful coffee'
          : 'Read a little every day'
        : 'Building Hoyst',
    commitment: quantity
      ? 'Make room for a thoughtful daily routine.'
      : 'One task a day to help build the Hoyst app',
    category: quantity ? 'Wellness' : 'Deep Work',
    commitmentType:
      mode === 'Avoid'
        ? 'avoid'
        : mode === 'Limit' || mode === 'Range'
        ? 'limit'
        : 'build',
    targetValue: 30,
    maximumValue: 3,
    minimumValue: mode === 'Range' ? 2 : undefined,
    unitLabel: mode === 'Limit' || mode === 'Range' ? 'cups' : 'pages',
    state: 'active',
    streakDays: 4,
    streakLabel: '4d streak',
  } as CircleDetailModel;
  return (
    <DesignSystemProvider scheme={dark ? 'dark' : 'light'}>
      <ComposerSheet
        navigation={navigation as never}
        footer={
          mode === 'Skipped' ||
          mode === 'Loading' ||
          mode === 'Error' ? undefined : (
            <View style={composerStyles.footerActions}>
              <ComposerAction
                category={quantity ? 'purple' : 'blue'}
                busy={mode === 'Busy'}
                label={
                  mode === 'Busy'
                    ? 'Submitting...'
                    : quantity
                    ? saved
                      ? 'Update Progress'
                      : 'Log Progress'
                    : 'Tap In'
                }
                onPress={() => setSaved(true)}
              />
              <ComposerQuietAction
                label="Use Skip (2 left)"
                disabled={mode === 'Busy'}
                onPress={() => navigation.goBack()}
              />
            </View>
          )
        }>
        <ComposerHeader
          detail={mode === 'Loading' ? undefined : detail}
          status={saved ? 'Saved today' : 'Ready for today'}
          onClose={() => navigation.goBack()}
        />
        <View style={composerStyles.body}>
          {mode === 'Loading' || mode === 'Error' ? (
            <DSFeedback
              kind={mode === 'Loading' ? 'loading' : 'error'}
              title={
                mode === 'Loading' ? 'Loading Tap In' : 'Tap In unavailable'
              }
              message="Local preview. No network request."
            />
          ) : mode === 'Skipped' ? (
            <DSSurface kind="quiet">
              <DSText variant="title">Skipped today</DSText>
              <DSText tone="muted">Your Skip is saved.</DSText>
              <DSButton
                variant="danger"
                label="Remove Skip"
                onPress={() => navigation.goBack()}
              />
            </DSSurface>
          ) : (
            <>
              {quantity ? (
                <ComposerQuantity
                  detail={detail}
                  value={value}
                  saved={saved}
                  onDecrease={() => setValue(Math.max(0, value - 1))}
                  onIncrease={() => setValue(value + 1)}
                />
              ) : (
                <ComposerPhoto
                  uri={uri}
                  disabled={mode === 'Busy'}
                  onAdd={() => setUri(photo)}
                  onRemove={() => setUri(undefined)}
                />
              )}
              {mode === 'Editor' || saved ? (
                <ComposerDetailsPresentation
                  category="blue"
                  isExpanded={expanded}
                  isSaving={false}
                  isDirty={Boolean(note)}
                  hasSavedDetails={saved}
                  disclosureTitle="Edit Tap In details"
                  disclosureSubtitle="Optional note or photo"
                  noteDraft={note}
                  visiblePhotoUri={uri}
                  onOpen={() => setExpanded(true)}
                  onClose={() => setExpanded(false)}
                  onNote={setNote}
                  onAddPhoto={() => setUri(photo)}
                  onSave={() => {
                    setSaved(true);
                    setExpanded(false);
                  }}
                  onRemovePhoto={() => setUri(undefined)}
                />
              ) : null}
            </>
          )}
        </View>
      </ComposerSheet>
    </DesignSystemProvider>
  );
}

export function TapInComposerPreview({onClose}: {onClose: () => void}) {
  const appearance = useSettingsStore(state => state.appearance);
  const systemScheme = useColorScheme();
  const {width, fontScale} = useWindowDimensions();
  const [dark, setDark] = useState(
    appearance === 'dark' ||
      (appearance === 'system' && systemScheme === 'dark'),
  );
  return (
    <DesignSystemProvider scheme={dark ? 'dark' : 'light'}>
      <NavigationIndependentTree>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            <Stack.Screen name="Menu">
              {({navigation}) => (
                <SafeAreaView
                  style={{
                    flex: 1,
                    backgroundColor: dark ? '#121212' : '#FAFAF7',
                  }}>
                  <ScrollView contentContainerStyle={{padding: 22, gap: 12}}>
                    <DSText variant="screenTitle">Tap In previews</DSText>
                    <DSText tone="muted">
                      Local fixtures. Actions do not save to an account. {width}{' '}
                      pt · text scale {fontScale.toFixed(2)}.
                    </DSText>
                    <DSButton
                      label={dark ? 'Use light theme' : 'Use dark theme'}
                      onPress={() => setDark(!dark)}
                    />
                    {modes.map(mode => (
                      <DSButton
                        key={mode}
                        label={mode}
                        variant="outline"
                        onPress={() =>
                          navigation.navigate('Sheet', {mode, dark})
                        }
                      />
                    ))}
                    <DSButton
                      label="Close previews"
                      variant="quiet"
                      onPress={onClose}
                    />
                  </ScrollView>
                </SafeAreaView>
              )}
            </Stack.Screen>
            <Stack.Screen
              name="Sheet"
              component={Fixture}
              options={getTapInComposerScreenOptions(
                dark ? '#121212' : '#FAFAF7',
              )}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </NavigationIndependentTree>
    </DesignSystemProvider>
  );
}
