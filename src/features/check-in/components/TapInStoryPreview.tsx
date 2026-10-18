import React, {useEffect, useRef, useState} from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  circlePeriodForDate,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';
import type {TapInStoryMoment} from '../services/tap-in-story-context';
import {
  buildTapInStoryShareData,
  captureTapInStoryImage,
} from '../services/tap-in-story-share';
import {TapInStoryTemplateCard} from './TapInStoryShareCard';

/** Local fixtures for inspecting actual native cards and their PNG exports. */
export function TapInStoryPreview({
  mode,
  onClose,
}: {
  mode: string;
  onClose: () => void;
}) {
  const {width, height} = useWindowDimensions();
  const ref = useRef<View>(null);
  const [exportUri, setExportUri] = useState('Preparing PNG…');
  const [ready, setReady] = useState(!mode.includes('photo'));
  const long = mode.includes('long');
  const personal = mode.includes('personal');
  const unknown = mode.includes('unknown');
  const cadence = mode.includes('monthly')
    ? 'monthly'
    : mode.includes('daily')
    ? 'daily'
    : 'weekly';
  const unit =
    cadence === 'daily' ? 'day' : cadence === 'monthly' ? 'month' : 'week';
  const confirmation = mode.includes('confirmation');
  const templateId = mode.includes('transparent')
    ? 'transparentOverlay'
    : 'tapInMoment';
  const tapIn: TapInStoryMoment = {
    dateKey: '2026-10-17',
    status: confirmation
      ? 'done'
      : mode.includes('failed')
      ? 'failed'
      : 'partial',
    ...(!confirmation
      ? {
          currentValue: mode.includes('large') ? 12345.5 : 12,
          targetValue: 20,
          unitLabel: mode.includes('large')
            ? 'minutes of focused practice'
            : 'pages',
        }
      : {}),
  };
  const progress: CircleProgressSummary = {
    version: 2,
    revision: 'fixture',
    asOfDateKey: tapIn.dateKey,
    cadence,
    period: circlePeriodForDate(tapIn.dateKey, cadence),
    progress: {covered: 2, required: 4, outcome: 'open'},
    streak: {count: 3, unit, availability: 'ready'},
  };
  const story = buildTapInStoryShareData({
    detail: {
      category: 'Learning',
      circleMode: personal ? 'personal' : 'group',
      title: long
        ? 'A wonderfully long Circle title for everyday readers'
        : 'A little reading, every day',
      commitment: long
        ? 'Read something worthwhile and make steady progress through the books we have been meaning to finish together.'
        : 'Read 20 pages, 4 times a week',
      commitmentType: 'build',
      buildTrackingMode: 'quantity',
      commitmentCadence: cadence,
      inviteUrl: 'https://hoyst.app/join/preview',
      memberCount: 8,
      members: [
        {id: 'a', name: 'Avery', initials: 'AV', state: 'done'},
        {id: 'b', name: 'Casey', initials: 'CA', state: 'done'},
        {id: 'c', name: 'Jordan', initials: 'JO', state: 'done'},
      ],
    },
    tapIn,
    context: {
      tapIn,
      progress: unknown
        ? undefined
        : {
            viewer: progress,
            group: {
              ...progress,
              progress: {covered: 3, required: 8, outcome: 'open'},
              streak: {count: 2, unit, availability: 'ready'},
            },
          },
    },
    photoUri: mode.includes('photo')
      ? Image.resolveAssetSource(
          require('../../../assets/hoy/goal-completed.png'),
        ).uri
      : undefined,
  });
  useEffect(() => {
    if (!ready) {
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      captureTapInStoryImage(ref)
        .then(uri => {
          if (active) {
            setExportUri(uri);
          }
        })
        .catch(error => {
          if (active) {
            setExportUri(String(error));
          }
        });
    }, 800);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, mode]);
  const scale = Math.min((width - 24) / 360, (height - 120) / 640, 1);
  return (
    <View style={styles.screen}>
      <View collapsable={false} ref={ref} style={styles.capture}>
        <TapInStoryTemplateCard
          story={story}
          templateId={templateId}
          onImageSettled={() => setReady(true)}
        />
      </View>
      <View style={{width: 360 * scale, height: 640 * scale}}>
        <View style={[styles.previewCard, {transform: [{scale}]}]}>
          <TapInStoryTemplateCard
            story={story}
            templateId={templateId}
            showTransparencyGrid={templateId === 'transparentOverlay'}
          />
        </View>
      </View>
      <Text style={styles.caption}>{mode} · Native 1080 × 1920 export</Text>
      <Text numberOfLines={2} style={styles.path}>
        {exportUri}
      </Text>
      <Pressable accessibilityLabel="Close story preview" onPress={onClose}>
        <Text style={styles.caption}>Close preview</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  previewCard: {width: 360, height: 640, transformOrigin: 'top left'},
  screen: {
    flex: 1,
    backgroundColor: '#242630',
    paddingTop: 45,
    alignItems: 'center',
  },
  capture: {position: 'absolute', left: -1200, width: 360, height: 640},
  caption: {color: '#FFFFFF', fontSize: 12, marginTop: 8},
  path: {color: '#BAC2D0', fontSize: 8, paddingHorizontal: 20, marginTop: 4},
});
