import React, {useCallback, useRef, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {CalendarCheck, Trophy} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {
  DesignSystemProvider,
  DSButton,
  DSSurface,
  DSText,
  useSystemTheme,
} from '../../../design/system';
import {BrandMark} from '../../../design/components/BrandMark';
import {useSessionStore} from '../../../store/session-store';
import type {RootStackParamList} from '../../../navigation/types';
import {shareTapInStoryImage} from '../../check-in/services/tap-in-story-share';
import {ProgressStatBadge} from '../../progress/components/ProgressStatBadge';
import {ProfileAvatar} from '../components/ProfileAvatar';
import {
  ProfileIcon,
  ProfileScaffold,
  ProfileTheme,
} from '../components/ProfileScaffold';
import {useProfileOverview} from '../hooks/useProfileOverview';
import {
  getProfileTintColor,
  profileShareMessage,
} from '../services/profile-personalization';
import {useProfilePreview} from '../components/ProfilePreviewContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileShare'>;
export function ProfileShareScreen(props: Props) {
  return (
    <ProfileTheme>
      <Content {...props} />
    </ProfileTheme>
  );
}
function Content({navigation}: Props) {
  const overview = useProfileOverview();
  const preview = useProfilePreview();
  const fallbackUrl = useSessionStore(state => state.user?.photoURL);
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const avatarKey = `${overview.profile?.id}:${
    overview.profile?.avatarUrl ?? (preview ? '' : fallbackUrl) ?? 'initials'
  }`;
  const [readyAvatarKey, setReadyAvatarKey] = useState<string>();
  const imageReady = useCallback(
    () => setReadyAvatarKey(avatarKey),
    [avatarKey],
  );
  const ready = Boolean(
    overview.profile &&
      overview.stats &&
      overview.progress &&
      overview.momentumLabel &&
      !overview.momentumError &&
      !overview.error &&
      !overview.refreshing &&
      readyAvatarKey === avatarKey,
  );
  const share = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      const profileUid = overview.profile?.id;
      await shareTapInStoryImage(card, profileShareMessage, () =>
        Boolean(preview || useSessionStore.getState().user?.uid === profileUid),
      );
    } catch (reason) {
      Alert.alert(
        'Could not share profile',
        reason instanceof Error ? reason.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <ProfileScaffold title="Share profile" onBack={navigation.goBack}>
      <DSText tone="muted">A little progress worth sharing.</DSText>
      {overview.error || overview.momentumError ? (
        <DSSurface>
          <DSText tone="danger">
            {overview.error ?? 'Momentum is unavailable. Please try again.'}
          </DSText>
          <DSButton
            label="Try again"
            onPress={overview.refresh}
            variant="quiet"
          />
        </DSSurface>
      ) : null}
      {overview.profile && overview.stats && overview.progress ? (
        <DesignSystemProvider scheme="light">
          <ShareCard
            overview={overview}
            cardRef={card}
            onImageReady={imageReady}
            fallbackUrl={preview ? undefined : fallbackUrl}
          />
        </DesignSystemProvider>
      ) : (
        <DSText tone="muted">Loading your profile card...</DSText>
      )}
      <DSButton
        label="Share"
        disabled={!ready}
        busy={busy}
        onPress={() => void share()}
        testID="profile-share-export"
      />
      <DSText variant="secondary" tone="muted" style={styles.center}>
        Share your card and an invitation to Hoyst.
      </DSText>
    </ProfileScaffold>
  );
}
function ShareCard({
  overview,
  cardRef,
  onImageReady,
  fallbackUrl,
}: {
  overview: ReturnType<typeof useProfileOverview>;
  cardRef: React.RefObject<View | null>;
  onImageReady: () => void;
  fallbackUrl?: string;
}) {
  const theme = useSystemTheme();
  const {profile, stats, progress} = overview;
  if (!profile || !stats || !progress) return null;
  const color = getProfileTintColor(profile.profileTint);
  // Export is fixed artwork. Native controls outside the card retain full font scaling.
  return (
    <View
      ref={cardRef}
      collapsable={false}
      style={styles.card}
      testID="profile-share-card">
      <LinearGradient
        pointerEvents="none"
        colors={[`${color}45`, `${color}00`]}
        style={styles.tint}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${color}00`, `${color}24`]}
        style={styles.inviteTint}
      />
      <View style={styles.cardBody}>
        <BrandMark kind="logo" isDark={false} style={styles.logo} />
        <View style={styles.identity}>
          <ProfileAvatar
            profile={profile}
            fallbackUrl={fallbackUrl}
            size={76}
            onReady={onImageReady}
          />
          <DSText
            allowFontScaling={false}
            style={styles.name}
            numberOfLines={2}>
            {profile.name}
          </DSText>
          <DSText allowFontScaling={false} tone="muted" style={styles.handle}>
            @{profile.handle}
          </DSText>
          {profile.bio ? (
            <DSText
              allowFontScaling={false}
              tone="muted"
              style={styles.cardBio}
              numberOfLines={3}>
              {profile.bio}
            </DSText>
          ) : null}
        </View>
        <View style={styles.xp}>
          <View style={styles.xpHeader}>
            <DSText allowFontScaling={false} variant="action">
              Level {progress.level} · {progress.totalXP.toLocaleString()} total
              XP
            </DSText>
            <DSText allowFontScaling={false} variant="secondary">
              {progress.levelXP} / {progress.requiredXP} XP
            </DSText>
          </View>
          <View style={[styles.track, {backgroundColor: theme.track}]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(
                    100,
                    (100 * progress.levelXP) / Math.max(1, progress.requiredXP),
                  )}%`,
                },
              ]}
            />
          </View>
        </View>
        <View style={[styles.stats, {borderColor: theme.border}]}>
          {[
            {
              value: `${stats.personalStreakDays} ${
                stats.personalStreakDays === 1 ? 'day' : 'days'
              }`,
              label: 'Current streak',
              icon: <ProgressStatBadge tone="orange" />,
            },
            {
              value: overview.momentumLabel ?? '-',
              label: overview.momentumLabel?.includes(' of 3')
                ? 'Momentum calibration'
                : '14-day momentum',
              icon: <ProgressStatBadge tone="blue" />,
            },
            {
              value: stats.totalTapIns.toLocaleString(),
              label: 'Total Tap Ins',
              icon: <ProfileIcon icon={CalendarCheck} tone="green" />,
            },
          ].map(stat => (
            <View key={stat.label} style={styles.stat}>
              {stat.icon}
              <DSText
                allowFontScaling={false}
                variant="title"
                style={styles.center}>
                {stat.value}
              </DSText>
              <DSText
                allowFontScaling={false}
                variant="statCaption"
                tone="muted"
                style={styles.center}>
                {stat.label}
              </DSText>
            </View>
          ))}
        </View>
        <View style={styles.best}>
          <Trophy size={17} color="#A36C00" />
          <DSText allowFontScaling={false} variant="secondary" tone="muted">
            Longest streak ·{' '}
            <DSText allowFontScaling={false} variant="action">
              {stats.longestStreakDays}{' '}
              {stats.longestStreakDays === 1 ? 'day' : 'days'}
            </DSText>
          </DSText>
        </View>
        <View style={styles.invite}>
          <DSText allowFontScaling={false} variant="heading">
            Join me on Hoyst
          </DSText>
          <DSText allowFontScaling={false} tone="action" variant="title">
            hoyst.app
          </DSText>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  center: {textAlign: 'center'},
  card: {
    aspectRatio: 9 / 16,
    backgroundColor: '#FAFAF7',
    borderRadius: 20,
    overflow: 'hidden',
  },
  tint: {position: 'absolute', top: 0, left: 0, right: 0, height: '45%'},
  inviteTint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '23%',
  },
  cardBody: {
    flex: 1,
    padding: 16,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 8,
  },
  logo: {width: 98, height: 36, alignSelf: 'center'},
  identity: {alignItems: 'center', gap: 3},
  name: {fontSize: 20, lineHeight: 25, fontWeight: '600', textAlign: 'center'},
  handle: {fontSize: 13, lineHeight: 18},
  cardBio: {fontSize: 12, lineHeight: 16, textAlign: 'center'},
  xp: {gap: 7},
  xpHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  track: {height: 6, borderRadius: 6, overflow: 'hidden'},
  fill: {height: '100%', backgroundColor: '#FF6D00'},
  stats: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  stat: {flex: 1, alignItems: 'center', gap: 4},
  best: {
    backgroundColor: '#FFF6DC',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  invite: {alignItems: 'center', gap: 4, paddingVertical: 10},
});
