import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Share, StyleSheet, View} from 'react-native';
import {Check, Info, Share2} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystInput} from '../../../design/components/HoystInput';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {
  CircleJoinMode,
  CirclePrivacy,
  CirclePrivacyMode,
} from '../../../types/models';
import {getPrivacyChoiceFields} from '../../create-circle/services/create-circle-draft';
import {CommitmentSetupScaffold} from '../../create-circle/components/CommitmentSetupScaffold';
import {
  privacyOptions,
  publicJoinOptions,
  SetupNumericStepper,
  SetupOptionList,
} from '../../create-circle/components/CommitmentSetupFields';
import {convertPersonalCircle} from '../services/circle-service';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'ConvertPersonalCircle'
>;

type ConvertedCircle = {
  inviteCode: string;
  inviteUrl: string;
};

export function ConvertPersonalCircleScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const allowExitRef = useRef(false);
  const [title, setTitle] = useState('');
  const [privacyMode, setPrivacyMode] = useState<CirclePrivacyMode>('public');
  const [joinMode, setJoinMode] = useState<CircleJoinMode>('request_to_join');
  const [maxSize, setMaxSize] = useState(10);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedCircle, setConvertedCircle] = useState<ConvertedCircle>();
  const canConvert =
    title.trim().length > 0 && title.trim().length <= 80 && !isConverting;
  const isDirty = useMemo(
    () =>
      title.length > 0 ||
      privacyMode !== 'public' ||
      joinMode !== 'request_to_join' ||
      maxSize !== 10,
    [joinMode, maxSize, privacyMode, title],
  );
  const publicJoinMode =
    joinMode === 'open' || joinMode === 'request_to_join'
      ? joinMode
      : 'request_to_join';

  useEffect(
    () => {
      if (typeof navigation.addListener !== 'function') {
        return undefined;
      }

      return navigation.addListener('beforeRemove', event => {
        if (allowExitRef.current || !isDirty) {
          return;
        }

        event.preventDefault();
        Alert.alert(
          'Discard Circle setup?',
          'Your Personal commitment will stay unchanged.',
          [
            {style: 'cancel', text: 'Keep editing'},
            {
              onPress: () => {
                allowExitRef.current = true;
                navigation.dispatch(event.data.action);
              },
              style: 'destructive',
              text: 'Discard',
            },
          ],
        );
      });
    },
    [isDirty, navigation],
  );

  const selectPrivacy = (nextMode: CirclePrivacyMode) => {
    const resolvedPublicJoinMode =
      joinMode === 'open' || joinMode === 'request_to_join'
        ? joinMode
        : 'request_to_join';
    const fields = getPrivacyChoiceFields(nextMode, resolvedPublicJoinMode);

    setPrivacyMode(nextMode);
    setJoinMode(fields.joinMode);
  };

  const handleConvert = async () => {
    if (!canConvert) {
      return;
    }

    setIsConverting(true);
    try {
      const fields = getPrivacyChoiceFields(
        privacyMode,
        joinMode === 'open' ? 'open' : 'request_to_join',
      );
      const result = await convertPersonalCircle({
        circleId: route.params.circleId,
        joinMode: fields.joinMode,
        maxSize,
        privacy: fields.privacy as CirclePrivacy,
        title: title.trim(),
      });

      allowExitRef.current = true;
      setConvertedCircle(result);
    } catch (error) {
      Alert.alert(
        'Conversion failed',
        (error as {message?: string}).message ??
          'Could not convert this Commitment. Try again.',
      );
    } finally {
      setIsConverting(false);
    }
  };

  const shareInvite = async () => {
    if (!convertedCircle) {
      return;
    }

    await Share.share({
      message: `Join ${title.trim()} on Hoyst: ${convertedCircle.inviteUrl}`,
      title: `Join ${title.trim()} on Hoyst`,
      url: convertedCircle.inviteUrl,
    });
  };

  if (convertedCircle) {
    return (
      <HoystScreen
        background={<FrostedBackdrop />}
        contentContainerStyle={styles.content}>
        <View style={styles.successHeader}>
          <View
            style={[
              styles.successIcon,
              {
                backgroundColor: `${theme.success}20`,
                borderColor: theme.successForeground,
              },
            ]}>
            <Check color={theme.successForeground} size={28} strokeWidth={3} />
          </View>
          <HoystText style={styles.centerText} variant="largeTitle">
            Circle ready
          </HoystText>
          <HoystText style={styles.centerText} tone="muted">
            Your history is now available in the Circle and the invite is ready.
          </HoystText>
        </View>
        <GlassPanel style={styles.stack}>
          <HoystText tone="muted" variant="label">
            Invite link
          </HoystText>
          <HoystText style={{color: theme.accentSecondaryForeground}}>
            {convertedCircle.inviteUrl}
          </HoystText>
        </GlassPanel>
        <View style={styles.stack}>
          <HoystButton
            icon={
              <Share2
                color={theme.onBrightAccent}
                size={18}
                strokeWidth={2.3}
              />
            }
            label="Share invite"
            onPress={() => shareInvite().catch(() => undefined)}
            variant="secondary"
          />
          <HoystButton
            label="View Circle"
            onPress={() =>
              navigation.replace('CircleDetail', {
                circleId: route.params.circleId,
              })
            }
            variant="outline"
          />
        </View>
      </HoystScreen>
    );
  }

  return (
    <CommitmentSetupScaffold
      body="Choose the Circle settings that will apply before you invite someone."
      eyebrow="Personal commitment"
      onBack={() => navigation.goBack()}
      primaryAction={{
        disabled: !canConvert,
        label: isConverting
          ? 'Converting...'
          : 'Convert to Circle and create invite',
        onPress: () => handleConvert().catch(() => undefined),
      }}
      title="Convert to a Circle">
      <GlassPanel style={styles.stack}>
        <HoystText variant="title">Basics</HoystText>
        <HoystText tone="muted" variant="label">
          Circle name
        </HoystText>
        <HoystInput
          autoCapitalize="words"
          maxLength={80}
          onChangeText={setTitle}
          placeholder="The 5AM Vanguard"
          value={title}
        />
        <HoystText tone="muted" variant="caption">
          {title.trim().length}/80 characters
        </HoystText>
      </GlassPanel>

      <GlassPanel style={styles.stack}>
        <HoystText variant="title">Access</HoystText>
        <SetupOptionList
          onSelect={selectPrivacy}
          options={privacyOptions}
          selected={privacyMode}
        />
        {privacyMode === 'public' ? (
          <View style={styles.stack}>
            <HoystText tone="muted" variant="label">
              Public join rule
            </HoystText>
            <SetupOptionList
              onSelect={setJoinMode}
              options={publicJoinOptions}
              selected={publicJoinMode}
            />
          </View>
        ) : null}
      </GlassPanel>

      <GlassPanel style={styles.stack}>
        <HoystText variant="title">Capacity</HoystText>
        <SetupNumericStepper
          label="Maximum Members"
          max={100}
          min={2}
          onChange={setMaxSize}
          value={maxSize}
        />
      </GlassPanel>

      <GlassPanel
        style={[styles.notice, {borderColor: `${theme.warningForeground}66`}]}>
        <Info color={theme.warningForeground} size={20} strokeWidth={2.3} />
        <HoystText style={styles.noticeCopy} tone="muted">
          All prior Tap Ins, notes, photos, and Progress will become visible to
          future Members.
        </HoystText>
      </GlassPanel>

    </CommitmentSetupScaffold>
  );
}

const styles = StyleSheet.create({
  centerText: {textAlign: 'center'},
  content: {gap: 18, paddingBottom: 60},
  notice: {alignItems: 'flex-start', flexDirection: 'row', gap: 10},
  noticeCopy: {flex: 1},
  stack: {gap: 12},
  successHeader: {alignItems: 'center', gap: 12, paddingTop: 24},
  successIcon: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
});
