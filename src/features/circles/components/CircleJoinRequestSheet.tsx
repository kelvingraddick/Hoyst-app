import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {HoystText} from '../../../design/components/HoystText';
import {LayeredAvatar} from '../../../design/components/LayeredAvatar';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getSystemTheme} from '../../../design/system/tokens';
import type {
  CircleDetailModel,
  CircleMemberStatus,
} from '../../../types/models';
import {reviewJoinRequest} from '../services/circle-service';
import {
  canReviewCircleJoinRequests,
  getPendingCircleJoinRequests,
  joinRequestCountLabel,
} from '../services/join-request-selectors';

function requestKey(member: CircleMemberStatus) {
  return `${member.id}:${
    member.requestedAt?.getTime() ?? member.joinedAt?.getTime() ?? ''
  }`;
}

export function CircleJoinRequestSheet({
  circle,
  visible,
  firstRequesterId,
  onClose,
}: {
  circle: CircleDetailModel;
  visible: boolean;
  firstRequesterId?: string;
  onClose: () => void;
}) {
  const theme = useHoystTheme();
  const accentForeground = getSystemTheme(
    theme.isDark ? 'dark' : 'light',
  ).progress;
  const {height, fontScale} = useWindowDimensions();
  const [busyId, setBusyId] = useState<string>();
  const [feedback, setFeedback] = useState<{
    message: string;
    error?: boolean;
  }>();
  // Hide confirmed decisions while the member snapshot catches up. A later
  // request from the same person has a new requestedAt and remains reviewable.
  const [handledKeys, setHandledKeys] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const pending = useMemo(() => getPendingCircleJoinRequests(circle), [circle]);
  const latest = useRef({circle, visible, pending});
  latest.current = {circle, visible, pending};
  const requests = pending
    .filter(member => !handledKeys.has(requestKey(member)))
    .sort(
      (left, right) =>
        Number(right.id === firstRequesterId) -
        Number(left.id === firstRequesterId),
    );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const currentKeys = new Set(pending.map(requestKey));
    setHandledKeys(previous => {
      const next = new Set([...previous].filter(key => currentKeys.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [pending]);

  const submit = async (member: CircleMemberStatus, approved: boolean) => {
    const current = latest.current;
    if (
      inFlight.current ||
      !current.visible ||
      !canReviewCircleJoinRequests(current.circle) ||
      !current.pending.some(
        candidate => requestKey(candidate) === requestKey(member),
      ) ||
      handledKeys.has(requestKey(member))
    ) {
      return;
    }
    inFlight.current = true;
    setBusyId(member.id);
    setFeedback(undefined);
    try {
      const result = await reviewJoinRequest({
        circleId: current.circle.id,
        requesterId: member.id,
        approved,
      });
      if (!mounted.current) {
        return;
      }
      setHandledKeys(previous => new Set([...previous, requestKey(member)]));
      setFeedback({
        message:
          result.status === 'approved'
            ? `${member.name} approved. Their first Tap In starts at the next window.`
            : `${member.name}'s request was declined.`,
      });
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      const failure = error as {code?: string; message?: string};
      if (failure.code?.endsWith('not-found')) {
        setHandledKeys(previous => new Set([...previous, requestKey(member)]));
        setFeedback({message: 'This request is no longer pending.'});
      } else {
        setFeedback({
          error: true,
          message:
            failure.message ?? 'Could not review this request. Try again.',
        });
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setBusyId(undefined);
      }
    }
  };

  const deny = (member: CircleMemberStatus) => {
    if (inFlight.current) {
      return;
    }
    Alert.alert(
      'Deny join request?',
      `Deny ${member.name}'s request to join ${circle.title}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Deny',
          style: 'destructive',
          onPress: () => {
            submit(member, false).catch(() => undefined);
          },
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      visible={visible && canReviewCircleJoinRequests(circle)}
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={styles.scrim}
          testID="join-requests-backdrop"
        />
        <SafeAreaView
          edges={['bottom']}
          style={[
            styles.safeArea,
            {maxHeight: height * 0.9, backgroundColor: theme.panelSurface},
          ]}>
          <View accessibilityViewIsModal style={styles.panel}>
            <View style={styles.header}>
              <HoystText accessibilityRole="header" style={styles.heading}>
                Join requests
              </HoystText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close join requests"
                onPress={onClose}
                style={styles.close}>
                <HoystText
                  style={[styles.buttonText, {color: accentForeground}]}>
                  Close
                </HoystText>
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled">
              <HoystText style={styles.circleTitle}>{circle.title}</HoystText>
              <HoystText tone="muted" variant="caption">
                {joinRequestCountLabel(requests.length)}
              </HoystText>
              {feedback ? (
                <HoystText
                  accessibilityLiveRegion="polite"
                  role="status"
                  style={[
                    styles.feedback,
                    {
                      color: feedback.error
                        ? theme.dangerForeground
                        : theme.successForeground,
                    },
                  ]}>
                  {feedback.message}
                </HoystText>
              ) : null}
              {requests.length === 0 ? (
                <HoystText
                  accessibilityLiveRegion="polite"
                  style={styles.empty}>
                  All requests handled
                </HoystText>
              ) : (
                requests.map(member => (
                  <View
                    key={requestKey(member)}
                    style={[styles.row, {borderColor: theme.border}]}
                    testID={`join-request-${member.id}`}>
                    <View style={styles.identity}>
                      <LayeredAvatar
                        chrome="minimal"
                        initials={member.initials}
                        imageSource={member.avatarImage}
                        imageUrl={member.avatarUrl}
                        size={44}
                        state="pending"
                      />
                      <View style={styles.name}>
                        <HoystText style={styles.requester}>
                          {member.name}
                        </HoystText>
                        <HoystText variant="caption" tone="muted">
                          Wants to join
                        </HoystText>
                      </View>
                      {busyId === member.id ? (
                        <ActivityIndicator
                          color={accentForeground}
                          accessibilityLabel={`Reviewing ${member.name}'s request`}
                        />
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.actions,
                        fontScale >= 1.5 && styles.largeActions,
                      ]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Deny ${member.name}'s join request`}
                        accessibilityState={{disabled: Boolean(busyId)}}
                        disabled={Boolean(busyId)}
                        onPress={() => deny(member)}
                        style={[
                          styles.button,
                          {
                            borderColor: theme.borderStrong,
                          },
                          busyId ? styles.disabled : undefined,
                        ]}>
                        <HoystText
                          style={[
                            styles.buttonText,
                            {color: theme.dangerForeground},
                          ]}>
                          Deny
                        </HoystText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${member.name}'s join request`}
                        accessibilityState={{
                          disabled: Boolean(busyId),
                          busy: busyId === member.id,
                        }}
                        disabled={Boolean(busyId)}
                        onPress={() => {
                          submit(member, true).catch(() => undefined);
                        }}
                        style={[
                          styles.button,
                          {
                            backgroundColor: theme.accent,
                            borderColor: theme.accent,
                          },
                          busyId ? styles.disabled : undefined,
                        ]}>
                        <HoystText
                          style={[
                            styles.buttonText,
                            {color: theme.onPurpleAccent},
                          ]}>
                          Approve
                        </HoystText>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  disabled: {opacity: 0.5},
  root: {flex: 1, justifyContent: 'flex-end'},
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  safeArea: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  panel: {flexShrink: 1, paddingHorizontal: 22, paddingTop: 12},
  scroll: {flexShrink: 1},
  header: {
    flexShrink: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heading: {flex: 1, fontSize: 22, fontWeight: '700', lineHeight: 28},
  close: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  feedback: {marginTop: 14, fontSize: 14, lineHeight: 20},
  list: {gap: 12, paddingTop: 18, paddingBottom: 22},
  row: {borderWidth: 1, borderRadius: 20, padding: 16, gap: 14},
  identity: {alignItems: 'center', flexDirection: 'row', gap: 12},
  name: {flex: 1, minWidth: 0, gap: 3},
  requester: {fontSize: 17, fontWeight: '700', lineHeight: 23},
  actions: {flexDirection: 'row', gap: 12},
  largeActions: {flexDirection: 'column'},
  button: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {fontSize: 15, fontWeight: '700', lineHeight: 22},
  empty: {paddingVertical: 24, fontWeight: '600', textAlign: 'center'},
});
