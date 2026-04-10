import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {ArrowLeft, Bell, BellRing, CirclePlus, UserPlus} from 'lucide-react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {ActivityFeedCard} from '../../../design/components/ActivityFeedCard';
import {BrandMark} from '../../../design/components/BrandMark';
import {HoystButton} from '../../../design/components/HoystButton';
import {HoystChip} from '../../../design/components/HoystChip';
import {HoystScreen} from '../../../design/components/HoystScreen';
import {HoystText} from '../../../design/components/HoystText';
import {MonthProgressCard} from '../../../design/components/MonthProgressCard';
import {StatusAvatarRow} from '../../../design/components/StatusAvatarRow';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getCircleDetail} from '../mockData';
import type {RootStackParamList} from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CircleDetail'>;

function TopBarButton({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.topBarButton,
        {
          backgroundColor: theme.surfaceSoft,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      {children}
    </Pressable>
  );
}

export function CircleDetailScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const theme = useHoystTheme();
  const [poked, setPoked] = useState(false);
  const detail = getCircleDetail(route.params.circleId);

  return (
    <HoystScreen contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <TopBarButton onPress={() => navigation.goBack()}>
            <ArrowLeft color={theme.text} size={18} strokeWidth={2.3} />
          </TopBarButton>
          <BrandMark isDark={theme.isDark} kind="logo" style={styles.logo} />
        </View>
        <View style={styles.topActions}>
          <TopBarButton>
            <Bell color={theme.textMuted} size={16} strokeWidth={2.2} />
          </TopBarButton>
          <TopBarButton>
            <UserPlus color={theme.textMuted} size={16} strokeWidth={2.2} />
          </TopBarButton>
        </View>
      </View>

      <View style={styles.headline}>
        <View style={styles.tags}>
          <HoystChip label={detail.category} tone="purple" />
          <HoystText style={{color: theme.warning}} variant="caption">
            {detail.streakLabel}
          </HoystText>
        </View>
        <HoystText variant="display">{detail.title}</HoystText>
        <HoystText tone="muted">{detail.dailyGoal}</HoystText>
      </View>

      <StatusAvatarRow members={detail.members} />

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <HoystButton
            icon={<CirclePlus color="#0e0e0e" size={18} strokeWidth={2.5} />}
            label="Log Today"
            onPress={() =>
              navigation.navigate('CheckInModal', {
                circleId: detail.id,
                source: 'circle_detail',
              })
            }
          />
        </View>
        <View style={styles.actionButton}>
          <HoystButton
            icon={<BellRing color={theme.text} size={18} strokeWidth={2.2} />}
            label={poked ? 'Poked' : 'Poke All'}
            onPress={() => setPoked(true)}
            variant="outline"
          />
        </View>
      </View>

      <MonthProgressCard
        completionLabel={`${detail.completionRate}%`}
        days={detail.monthProgress}
        title="October Progress"
      />

      <View style={styles.activitySection}>
        <HoystText tone="muted" variant="label">
          Recent Activity
        </HoystText>
        {detail.activity.map(item => (
          <ActivityFeedCard item={item} key={item.id} />
        ))}
      </View>
    </HoystScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 108,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  topActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topBarButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    minWidth: 34,
    paddingHorizontal: 8,
  },
  logo: {
    height: 20,
    width: 48,
  },
  headline: {
    gap: 8,
  },
  tags: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  activitySection: {
    gap: 12,
  },
});
