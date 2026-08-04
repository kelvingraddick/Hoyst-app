import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronRight,
  LockKeyhole,
  UsersRound,
} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {FrostedBackdrop} from '../../../design/components/FrostedBackdrop';
import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {HeroIconButton} from '../../../design/components/ScreenHeroHeader';
import {actionMotion} from '../../../design/tokens/actions';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import type {RootStackParamList} from '../../../navigation/types';
import {useSessionStore} from '../../../store/session-store';
import {
  subscribeToArchivedCircles,
  type ArchivedCircleSummary,
} from '../services/archived-circle-service';
import {unarchiveCircle} from '../services/circle-service';

type Props = NativeStackScreenProps<RootStackParamList, 'ArchivedCircles'>;

function formatArchivedDate(date?: Date) {
  return date
    ? new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : 'Archived';
}

function ArchivedCircleCard({
  circle,
  isRestoring,
  onOpen,
  onRestore,
}: {
  circle: ArchivedCircleSummary;
  isRestoring: boolean;
  onOpen: () => void;
  onRestore: () => void;
}) {
  const theme = useHoystTheme();
  const isPersonal = circle.circleMode === 'personal';

  return (
    <GlassPanel style={styles.card}>
      <Pressable
        accessibilityLabel={`Open archived ${
          isPersonal ? 'Commitment' : 'Circle'
        } ${circle.title}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={({pressed}) => [
          styles.cardMain,
          {opacity: pressed ? actionMotion.pressedOpacity : 1},
        ]}>
        <View
          style={[
            styles.cardIcon,
            {backgroundColor: `${theme.accentSecondaryForeground}18`},
          ]}>
          {isPersonal ? (
            <LockKeyhole
              color={theme.accentSecondaryForeground}
              size={20}
              strokeWidth={2.2}
            />
          ) : (
            <UsersRound
              color={theme.accentSecondaryForeground}
              size={20}
              strokeWidth={2.2}
            />
          )}
        </View>
        <View style={styles.cardCopy}>
          <HoystText style={styles.cardTitle}>{circle.title}</HoystText>
          <HoystText numberOfLines={2} tone="muted" variant="caption">
            {circle.commitment}
          </HoystText>
          <HoystText tone="muted" variant="tiny">
            {isPersonal ? 'Personal commitment' : `${circle.memberCount} members`}
            {' · '}
            {formatArchivedDate(circle.archivedAt)}
          </HoystText>
        </View>
        <ChevronRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
      </Pressable>
      {circle.viewerRole === 'owner' ? (
        <HoystButton
          disabled={isRestoring}
          icon={
            <ArchiveRestore
              color={theme.actionForeground}
              size={18}
              strokeWidth={2.3}
            />
          }
          label={
            isRestoring
              ? 'Restoring...'
              : isPersonal
              ? 'Unarchive Commitment'
              : 'Unarchive Circle'
          }
          onPress={onRestore}
        />
      ) : null}
    </GlassPanel>
  );
}

export function ArchivedCirclesScreen({navigation}: Props) {
  const theme = useHoystTheme();
  const uid = useSessionStore(state => state.user?.uid);
  const [circles, setCircles] = useState<ArchivedCircleSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [restoringId, setRestoringId] = useState<string>();

  useEffect(() => {
    if (!uid) {
      setCircles([]);
      setHasLoaded(true);
      return undefined;
    }

    setHasLoaded(false);
    return subscribeToArchivedCircles({
      onCircles: nextCircles => {
        setCircles(nextCircles);
        setHasLoaded(true);
      },
      onError: () => setHasLoaded(true),
      uid,
    });
  }, [uid]);

  const sections = useMemo(
    () => [
      {
        circles: circles.filter(circle => circle.circleMode === 'personal'),
        title: 'Personal Commitments',
      },
      {
        circles: circles.filter(circle => circle.circleMode === 'group'),
        title: 'Circles',
      },
    ],
    [circles],
  );

  const restore = async (circle: ArchivedCircleSummary) => {
    if (restoringId) {
      return;
    }

    setRestoringId(circle.id);
    try {
      await unarchiveCircle(circle.id);
      Alert.alert(
        circle.circleMode === 'personal'
          ? 'Commitment restored'
          : 'Circle restored',
        'New Tap Ins will begin at the next scheduled opening.',
      );
    } catch (error) {
      Alert.alert(
        'Restore failed',
        (error as {message?: string}).message ??
          'Could not restore this commitment. Try again.',
      );
    } finally {
      setRestoringId(undefined);
    }
  };

  const confirmRestore = (circle: ArchivedCircleSummary) => {
    const isPersonal = circle.circleMode === 'personal';
    Alert.alert(
      isPersonal ? 'Unarchive Commitment?' : 'Unarchive Circle?',
      'Tap Ins and reminders will resume at the next scheduled opening. Time spent archived will not create missed opportunities.',
      [
        {style: 'cancel', text: 'Keep Archived'},
        {
          onPress: () => restore(circle).catch(() => undefined),
          text: isPersonal ? 'Unarchive Commitment' : 'Unarchive Circle',
        },
      ],
    );
  };

  return (
    <HoystScreen
      background={<FrostedBackdrop />}
      contentContainerStyle={styles.content}>
      <View style={styles.navRow}>
        <HeroIconButton
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </HeroIconButton>
        <HoystText style={styles.navTitle}>Archived</HoystText>
        <View style={styles.navSpacer} />
      </View>

      <View style={styles.heroCopy}>
        <View
          style={[
            styles.heroIcon,
            {backgroundColor: `${theme.accentSecondaryForeground}18`},
          ]}>
          <Archive
            color={theme.accentSecondaryForeground}
            size={24}
            strokeWidth={2.2}
          />
        </View>
        <View style={styles.heroText}>
          <HoystText style={styles.title}>Archived commitments & circles</HoystText>
          <HoystText tone="muted">
            History stays available. Owners can restore an item when it is
            ready to become active again.
          </HoystText>
        </View>
      </View>

      {!hasLoaded ? (
        <GlassPanel>
          <HoystText tone="muted">Loading archived items...</HoystText>
        </GlassPanel>
      ) : circles.length === 0 ? (
        <GlassPanel style={styles.emptyPanel}>
          <HoystText style={styles.emptyTitle}>Nothing archived</HoystText>
          <HoystText tone="muted" variant="caption">
            Commitments and Circles you archive will appear here.
          </HoystText>
        </GlassPanel>
      ) : (
        sections.map(section =>
          section.circles.length > 0 ? (
            <View key={section.title} style={styles.section}>
              <HoystText tone="muted" variant="label">
                {section.title}
              </HoystText>
              <View style={styles.cardStack}>
                {section.circles.map(circle => (
                  <ArchivedCircleCard
                    circle={circle}
                    isRestoring={restoringId === circle.id}
                    key={circle.id}
                    onOpen={() =>
                      navigation.navigate('CircleDetail', {circleId: circle.id})
                    }
                    onRestore={() => confirmRestore(circle)}
                  />
                ))}
              </View>
            </View>
          ) : null,
        )
      )}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  card: {gap: 14},
  cardCopy: {flex: 1, gap: 4},
  cardIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardMain: {alignItems: 'center', flexDirection: 'row', gap: 12},
  cardStack: {gap: 12},
  cardTitle: {fontSize: 17, fontWeight: '800', lineHeight: 21},
  content: {gap: 22, paddingBottom: 64, paddingHorizontal: 20},
  emptyPanel: {gap: 6},
  emptyTitle: {fontSize: 18, fontWeight: '800', lineHeight: 22},
  heroCopy: {alignItems: 'flex-start', flexDirection: 'row', gap: 14},
  heroIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  heroText: {flex: 1, gap: 6},
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navSpacer: {height: 44, width: 44},
  navTitle: {fontSize: 17, fontWeight: '800', lineHeight: 21},
  section: {gap: 10},
  title: {fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 33},
});
