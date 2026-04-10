import React from 'react';
import {StyleSheet, View} from 'react-native';

import type {CircleMemberStatus} from '../../types/models';
import {useHoystTheme} from '../theme/useHoystTheme';
import {HoystAvatar} from './HoystAvatar';
import {HoystText} from './HoystText';

type StatusAvatarRowProps = {
  members: CircleMemberStatus[];
};

export function StatusAvatarRow({
  members,
}: StatusAvatarRowProps): React.JSX.Element {
  const theme = useHoystTheme();

  return (
    <View style={styles.row}>
      {members.map(member => {
        const tone =
          member.state === 'done'
            ? 'green'
            : member.state === 'pending'
            ? 'purple'
            : 'muted';
        const label =
          member.state === 'done'
            ? 'DONE'
            : member.state === 'pending'
            ? 'PENDING'
            : 'MISSED';

        return (
          <View key={member.id} style={styles.member}>
            <View style={styles.avatarWrap}>
              <HoystAvatar
                initials={member.initials}
                imageSource={member.avatarImage}
                size={56}
                tone={tone}
              />
              {member.badgeCount ? (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor:
                        member.state === 'done'
                          ? theme.success
                          : member.state === 'pending'
                          ? theme.accent
                          : theme.surfaceHigh,
                    },
                  ]}>
                  <HoystText
                    style={
                      member.state === 'done'
                        ? styles.badgeLabelDark
                        : undefined
                    }
                    variant="tiny">
                    {String(member.badgeCount).padStart(2, '0')}
                  </HoystText>
                </View>
              ) : null}
            </View>
            <HoystText
              style={
                member.state === 'done'
                  ? {color: theme.success}
                  : member.state === 'pending'
                  ? {color: theme.accentSecondary}
                  : {color: theme.textSubtle}
              }
              variant="tiny">
              {label}
            </HoystText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  member: {
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    bottom: 0,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    width: 20,
  },
  badgeLabelDark: {
    color: '#0e0e0e',
  },
});
