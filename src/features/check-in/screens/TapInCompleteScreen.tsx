import React, {useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';
import {X} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {TapInRingMark} from '../../../design/components/TapInRingMark';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import type {CircleDetailModel} from '../../../types/models';
import {useUserProfileStore} from '../../../store/profile-store';
import {useSessionStore} from '../../../store/session-store';
import {subscribeToMemberCircleDetail} from '../../home/services/home-data-service';

type Props = NativeStackScreenProps<RootStackParamList, 'TapInComplete'>;

export function TapInCompleteScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [detail, setDetail] = useState<CircleDetailModel | undefined>();
  const profile = useUserProfileStore(state => state.profile);
  const status = useSessionStore(state => state.status);
  const user = useSessionStore(state => state.user);
  const timezone = profile?.timezone ?? 'UTC';
  const canLoadDetail = status === 'authenticatedReady' && Boolean(user?.uid);
  const note = route.params.note?.trim();
  const hasNote = Boolean(note);

  useEffect(() => {
    if (!canLoadDetail || !user?.uid) {
      setDetail(undefined);
      return undefined;
    }

    return subscribeToMemberCircleDetail({
      circleId: route.params.circleId,
      onDetail: setDetail,
      onError: () => setDetail(undefined),
      timezone,
      uid: user.uid,
    });
  }, [canLoadDetail, route.params.circleId, timezone, user?.uid]);

  const finish = () => {
    navigation.replace('TapInPicker');
  };
  const title = detail?.title ?? 'Your circle';
  const dailyTask = detail?.dailyTask ?? "Today's Tap In";

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.closeRow}>
        <Pressable
          onPress={finish}
          style={({pressed}) => [
            styles.closeButton,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}>
          <X color={theme.text} size={18} strokeWidth={2.4} />
        </Pressable>
      </View>

      <GlassPanel style={styles.panel}>
        <View style={styles.iconWrap}>
          <TapInRingMark innerSize={68} outerSize={122} />
        </View>

        <View style={styles.titleBlock}>
          <HoystText style={styles.centerText} variant="display">
            Tap In Complete
          </HoystText>
          <HoystText style={[styles.centerText, {color: theme.success}]}>
            {title} has your update for today.
          </HoystText>
        </View>

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: theme.surfaceSoft,
              borderColor: theme.borderStrong,
            },
          ]}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryCopy}>
              <HoystText tone="muted" variant="label">
                Today's Tap In
              </HoystText>
              <HoystText style={styles.summaryTitle}>{dailyTask}</HoystText>
            </View>
            <HoystText style={{color: theme.success}} variant="caption">
              Sent
            </HoystText>
          </View>
          <HoystText tone={hasNote ? 'primary' : 'muted'}>
            {hasNote ? note : 'No note added. Your Tap In still counts.'}
          </HoystText>
          {route.params.photoUri ? (
            <Image
              source={{uri: route.params.photoUri}}
              style={styles.summaryImage}
            />
          ) : null}
        </View>

        <HoystButton label="Done" onPress={finish} variant="secondary" />
      </GlassPanel>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingBottom: 32,
    paddingTop: 18,
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  panel: {
    minHeight: 520,
  },
  iconWrap: {
    alignItems: 'center',
  },
  titleBlock: {
    gap: 10,
  },
  centerText: {
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  summaryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  summaryImage: {
    borderRadius: radius.md,
    height: 188,
    width: '100%',
  },
});
