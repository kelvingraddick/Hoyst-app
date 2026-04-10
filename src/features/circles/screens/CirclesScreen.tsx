import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowRight, Plus} from 'lucide-react-native';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {GlassPanel} from '../../../design/components/GlassPanel';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {todayCircles} from '../mockData';
import type {
  AppTabsParamList,
  RootStackParamList,
} from '../../../navigation/types';

type Props = BottomTabScreenProps<AppTabsParamList, 'Circles'>;

export function CirclesScreen({navigation}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const rootNavigation =
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <HoystText variant="headline">Your circles</HoystText>
          <HoystText tone="muted">
            Jump into today’s groups, open the detail view, or launch a new one.
          </HoystText>
        </View>
        <HoystButton
          icon={<Plus color="#ffffff" size={18} strokeWidth={2.5} />}
          label="Create Circle"
          onPress={() => rootNavigation?.navigate('CreateCircle')}
          variant="secondary"
        />
      </View>

      <View style={styles.metaRow}>
        <HoystChip label="3 Active Circles" tone="green" />
        <HoystChip label="2 Need You Today" tone="orange" />
      </View>

      {todayCircles.map(circle => (
        <Pressable
          key={circle.id}
          onPress={() =>
            rootNavigation?.navigate('CircleDetail', {circleId: circle.id})
          }
          style={({pressed}) => [{opacity: pressed ? 0.94 : 1}]}>
          <GlassPanel>
            <View style={styles.rowHeader}>
              <View style={styles.rowCopy}>
                <HoystText variant="title">{circle.title}</HoystText>
                <HoystText tone="muted">{circle.dailyTask}</HoystText>
              </View>
              <ArrowRight color={theme.textSubtle} size={18} strokeWidth={2.2} />
            </View>
            <View style={styles.rowFooter}>
              <HoystChip
                label={circle.streakLabel}
                tone={circle.state === 'risk' ? 'orange' : 'green'}
              />
              <HoystText
                style={
                  circle.state === 'risk'
                    ? {color: theme.warning}
                    : circle.state === 'done'
                      ? {color: theme.success}
                      : {color: theme.accentSecondary}
                }
                variant="caption">
                {circle.state === 'active'
                  ? 'Tap to open detail'
                  : circle.state === 'done'
                    ? 'Daily log complete'
                    : 'Group streak at risk'}
              </HoystText>
            </View>
          </GlassPanel>
        </Pressable>
      ))}
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 168,
  },
  header: {
    gap: 14,
  },
  headerCopy: {
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowCopy: {
    flex: 1,
    gap: 6,
  },
  rowFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
