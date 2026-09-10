import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from 'react-native';
import {
  ArrowRight,
  Archive,
  Camera,
  Heart,
  Share2,
  X,
} from 'lucide-react-native';
import {launchImageLibrary} from 'react-native-image-picker';

import {HoystText} from '../../../design/components/HoystText';
import {
  DSAvatar,
  DSSectionHeading,
  useSystemTheme,
} from '../../../design/system';
import {actionMotion} from '../../../design/tokens/actions';
import {brandColors} from '../../../design/tokens/colors';
import {radius} from '../../../design/tokens/radius';
import {useHoystTheme} from '../../../design/theme/useHoystTheme';
import {getPhotoUploadErrorMessage} from '../../../lib/firebase/storage-error';
import type {CircleThreadItem} from '../../../types/models';
import {
  createCircleThreadMessageId,
  markCircleThreadRead,
  sendCircleThreadMessage,
  subscribeToCircleThreadItems,
  toggleCircleThreadItemLike,
  uploadCircleThreadImage,
} from '../services/circle-thread-service';
import {buildCircleThreadDaySections} from '../services/circle-thread-date';

type CircleThreadSectionProps = {
  circleId: string;
  isArchived: boolean;
  isVisible: boolean;
  loadMoreRequestToken: number;
  onLayout?: (event: LayoutChangeEvent) => void;
  onShareTapIn?: (item: CircleThreadItem) => void;
  timezone: string;
  viewer: {
    avatarSource?: ImageSourcePropType;
    initials: string;
    name: string;
  };
  viewerUid: string;
};

const THREAD_PAGE_SIZE = 20;

function formatDayMarkerLabel(label: string) {
  return label
    .toLocaleLowerCase('en-US')
    .replace(/(^|\s)[a-z]/g, character => character.toUpperCase());
}

function getActivityColor(
  tone: CircleThreadItem['tone'],
  theme: ReturnType<typeof useHoystTheme>,
) {
  if (tone === 'alert') {
    return theme.warningForeground;
  }

  if (tone === 'pending') {
    return theme.accentSecondaryForeground;
  }

  return theme.successForeground;
}

function LikeButton({
  disabled,
  item,
  onPress,
}: {
  disabled?: boolean;
  item: CircleThreadItem;
  onPress: () => void;
}) {
  const theme = useHoystTheme();
  const showCount = item.likeCount > 0;
  const showButton = !disabled || showCount;

  if (!showButton) {
    return null;
  }

  return (
    <Pressable
      accessibilityLabel={`Like ${item.kind}`}
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      style={({pressed}) => [
        styles.likeButton,
        {
          opacity: disabled ? 0.78 : pressed ? 0.72 : 1,
        },
      ]}>
      <Heart
        color={item.isLikedByViewer ? theme.dangerForeground : '#FF8A96'}
        fill={item.isLikedByViewer ? theme.dangerForeground : 'transparent'}
        size={18}
        strokeWidth={2.5}
      />
      {showCount ? (
        <HoystText style={styles.likeCount} tone="muted" variant="caption">
          {item.likeCount}
        </HoystText>
      ) : null}
    </Pressable>
  );
}

function canShareTapInActivity(item: CircleThreadItem, viewerUid?: string) {
  return Boolean(
    viewerUid &&
      item.kind === 'activity' &&
      item.activityType === 'tap_in' &&
      item.tone === 'success' &&
      item.actor.uid === viewerUid,
  );
}

function ShareTapInButton({onPress}: {onPress: () => void}) {
  const theme = useHoystTheme();

  return (
    <Pressable
      accessibilityLabel="Share Tap In"
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.shareTapInButton,
        {opacity: pressed ? actionMotion.pressedOpacity : 1},
      ]}>
      <Share2
        color={theme.accentSecondaryForeground}
        size={18}
        strokeWidth={2.4}
      />
    </Pressable>
  );
}

function ThreadRow({
  item,
  onLike,
  readOnly,
  onShareTapIn,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  readOnly?: boolean;
  onShareTapIn?: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  const theme = useHoystTheme();
  const isViewer = Boolean(viewerUid && item.actor.uid === viewerUid);
  const isLikeDisabled = isViewer || item.readOnly || readOnly;
  const canShare = Boolean(
    onShareTapIn && canShareTapInActivity(item, viewerUid),
  );
  const showActions = !isLikeDisabled || item.likeCount > 0 || canShare;
  const displayName = isViewer ? 'You' : item.actor.name;
  const actorPrefix = `${item.actor.name} `;
  const itemText = item.text ?? '';
  const activityText =
    item.kind === 'activity' && itemText.startsWith(actorPrefix)
      ? itemText.slice(actorPrefix.length)
      : itemText;
  const activityColor = getActivityColor(item.tone, theme);

  return (
    <View
      style={[styles.threadRow, {borderBottomColor: theme.border}]}
      testID={
        item.kind === 'activity'
          ? `circle-thread-activity-${item.id}`
          : `circle-thread-message-row-${item.id}`
      }>
      <View
        style={styles.rowAvatar}
        testID={`circle-thread-row-avatar-${item.id}`}>
        <DSAvatar
          accessibilityLabel={`${displayName} avatar`}
          name={item.actor.name || item.actor.initials}
          size={40}
          source={
            item.actor.avatarUrl ? {uri: item.actor.avatarUrl} : undefined
          }
        />
      </View>
      <View style={styles.rowCopy}>
        <HoystText style={styles.rowMessage}>
          <HoystText
            style={[styles.rowMessage, styles.rowActor]}
            testID={`circle-thread-message-author-${item.id}`}>
            {displayName}{' '}
          </HoystText>
          <HoystText
            style={[
              styles.rowMessage,
              item.kind === 'activity' ? {color: activityColor} : undefined,
            ]}>
            {activityText}
          </HoystText>
        </HoystText>
        {item.note ? (
          <HoystText style={styles.rowNote} tone="muted">
            {item.note}
          </HoystText>
        ) : null}
        <HoystText style={styles.rowTimestamp} tone="muted">
          {item.createdAtLabel}
        </HoystText>
      </View>
      {item.mediaImageUrl ? (
        <Image
          accessibilityLabel="Activity photo"
          resizeMode="cover"
          source={{uri: item.mediaImageUrl}}
          style={styles.rowThumbnail}
          testID={
            item.kind === 'activity'
              ? 'circle-thread-activity-image'
              : 'circle-thread-message-image'
          }
        />
      ) : null}
      {showActions ? (
        <View
          style={styles.rowActions}
          testID={`circle-thread-activity-like-row-${item.id}`}>
          <LikeButton
            disabled={isLikeDisabled}
            item={item}
            onPress={() => onLike(item)}
          />
          {canShare ? (
            <ShareTapInButton onPress={() => onShareTapIn?.(item)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ThreadItem({
  item,
  onLike,
  readOnly,
  onShareTapIn,
  viewerUid,
}: {
  item: CircleThreadItem;
  onLike: (item: CircleThreadItem) => void;
  readOnly?: boolean;
  onShareTapIn?: (item: CircleThreadItem) => void;
  viewerUid?: string;
}) {
  return (
    <ThreadRow
      item={item}
      onLike={onLike}
      readOnly={readOnly}
      onShareTapIn={onShareTapIn}
      viewerUid={viewerUid}
    />
  );
}

function mergeThreadItems(
  currentItems: CircleThreadItem[],
  nextItems: CircleThreadItem[],
) {
  const nextIds = new Set(nextItems.map(item => item.id));

  return [...nextItems, ...currentItems.filter(item => !nextIds.has(item.id))];
}

export function CircleThreadSection({
  circleId,
  isArchived,
  isVisible,
  loadMoreRequestToken,
  onLayout,
  onShareTapIn,
  timezone,
  viewer,
  viewerUid,
}: CircleThreadSectionProps): React.JSX.Element {
  const theme = useHoystTheme();
  const systemTheme = useSystemTheme();
  const [items, setItems] = useState<CircleThreadItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [threadError, setThreadError] = useState<Error>();
  const [requestedLimit, setRequestedLimit] = useState(THREAD_PAGE_SIZE);
  const [retryKey, setRetryKey] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [isSending, setIsSending] = useState(false);
  const [viewerAvatarFailed, setViewerAvatarFailed] = useState(false);
  const lastHandledLoadRequestRef = useRef(0);
  const lastMarkedItemIdRef = useRef<string | undefined>(undefined);
  const pendingMarkedItemIdRef = useRef<string | undefined>(undefined);
  const daySections = useMemo(
    () => buildCircleThreadDaySections({items, timezone}),
    [items, timezone],
  );

  useEffect(() => {
    return subscribeToCircleThreadItems({
      circleId,
      itemLimit: requestedLimit,
      onError: error => {
        setThreadError(error);
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      },
      onItems: result => {
        setItems(currentItems => mergeThreadItems(currentItems, result.items));
        setHasMore(result.hasMore);
        setThreadError(undefined);
        setIsInitialLoading(false);
        setIsLoadingMore(false);
      },
      uid: viewerUid,
    });
  }, [circleId, requestedLimit, retryKey, viewerUid]);

  useEffect(() => {
    if (
      loadMoreRequestToken === 0 ||
      loadMoreRequestToken === lastHandledLoadRequestRef.current ||
      !hasMore ||
      isInitialLoading ||
      isLoadingMore
    ) {
      return;
    }

    lastHandledLoadRequestRef.current = loadMoreRequestToken;
    setIsLoadingMore(true);
    setThreadError(undefined);
    setRequestedLimit(currentLimit => currentLimit + THREAD_PAGE_SIZE);
  }, [hasMore, isInitialLoading, isLoadingMore, loadMoreRequestToken]);

  useEffect(() => {
    const latestItemId = items[0]?.id;

    if (
      !isVisible ||
      isArchived ||
      !latestItemId ||
      latestItemId === lastMarkedItemIdRef.current ||
      latestItemId === pendingMarkedItemIdRef.current
    ) {
      return;
    }

    pendingMarkedItemIdRef.current = latestItemId;
    markCircleThreadRead(circleId)
      .then(() => {
        lastMarkedItemIdRef.current = latestItemId;
      })
      .catch(() => undefined)
      .finally(() => {
        if (pendingMarkedItemIdRef.current === latestItemId) {
          pendingMarkedItemIdRef.current = undefined;
        }
      });
  }, [circleId, isArchived, isVisible, items]);

  const handleChooseImage = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });
    const uri = response.assets?.[0]?.uri;

    if (uri) {
      setPhotoUri(uri);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
    let isUploadingPhoto = Boolean(photoUri);

    if (isSending || (!text && !photoUri)) {
      return;
    }

    setIsSending(true);
    try {
      const messageId = createCircleThreadMessageId(circleId);
      const mediaImageUrl = photoUri
        ? await uploadCircleThreadImage({
            circleId,
            messageId,
            uid: viewerUid,
            uri: photoUri,
          })
        : undefined;

      isUploadingPhoto = false;
      await sendCircleThreadMessage({
        circleId,
        mediaImageUrl,
        messageId,
        text: text || undefined,
      });
      setDraft('');
      setPhotoUri(undefined);
    } catch (error) {
      const message = isUploadingPhoto
        ? getPhotoUploadErrorMessage(error)
        : (error as {message?: string}).message ??
          'Could not send this message.';

      Alert.alert('Message failed', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleLike = (item: CircleThreadItem) => {
    if (isArchived || item.actor.uid === viewerUid) {
      return;
    }

    toggleCircleThreadItemLike({
      circleId,
      itemId: item.id,
    }).catch(error => {
      Alert.alert(
        'Like failed',
        (error as {message?: string}).message ?? 'Could not update the like.',
      );
    });
  };
  const handleRetry = () => {
    setThreadError(undefined);
    if (items.length === 0) {
      setIsInitialLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setRetryKey(currentKey => currentKey + 1);
  };
  const canSendMessage = Boolean(draft.trim() || photoUri) && !isSending;
  const viewerInitial =
    viewer.initials.trim().slice(0, 1).toUpperCase() ||
    viewer.name.trim().slice(0, 1).toUpperCase() ||
    '?';

  useEffect(() => {
    setViewerAvatarFailed(false);
  }, [viewer.avatarSource]);

  return (
    <View
      onLayout={onLayout}
      style={styles.section}
      testID="circle-thread-section">
      <DSSectionHeading title="Circle feed" />

      {isArchived ? (
        <View
          style={[
            styles.archivedFooter,
            {
              backgroundColor: systemTheme.surface,
              borderColor: systemTheme.border,
            },
          ]}
          testID="circle-thread-archived">
          <Archive color={theme.textMuted} size={18} strokeWidth={2.2} />
          <View style={styles.archivedFooterCopy}>
            <HoystText style={styles.archivedFooterTitle}>
              Archived Circle
            </HoystText>
            <HoystText tone="muted" variant="caption">
              This feed is read-only. Restore the Circle to send or react.
            </HoystText>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.composerSurface,
            {
              backgroundColor: systemTheme.surface,
              borderColor: systemTheme.border,
            },
          ]}
          testID="circle-thread-composer">
          <View style={styles.composerRow} testID="circle-thread-composer-row">
            <View
              accessibilityLabel={`${viewer.name} avatar`}
              accessible
              style={[
                styles.composerAvatar,
                {backgroundColor: systemTheme.mutedSurface},
              ]}
              testID="circle-thread-composer-avatar">
              {viewer.avatarSource && !viewerAvatarFailed ? (
                <Image
                  accessible={false}
                  onError={() => setViewerAvatarFailed(true)}
                  resizeMode="cover"
                  source={viewer.avatarSource}
                  style={styles.composerAvatarImage}
                  testID="circle-thread-composer-avatar-image"
                />
              ) : (
                <HoystText
                  style={styles.composerAvatarInitial}
                  testID="circle-thread-composer-avatar-initial">
                  {viewerInitial}
                </HoystText>
              )}
            </View>
            <View
              style={[
                styles.composerInputShell,
                {backgroundColor: systemTheme.mutedSurface},
              ]}
              testID="circle-thread-composer-input-shell">
              <TextInput
                editable={!isSending}
                multiline
                onChangeText={setDraft}
                placeholder="Share a message..."
                placeholderTextColor={systemTheme.muted}
                style={[styles.composerInput, {color: systemTheme.text}]}
                testID="circle-thread-composer-input"
                value={draft}
              />
              <View
                style={styles.composerActionCluster}
                testID="circle-thread-composer-actions">
                <Pressable
                  accessibilityLabel="Add image"
                  accessibilityRole="button"
                  accessibilityState={{disabled: isSending}}
                  disabled={isSending}
                  onPress={() => {
                    handleChooseImage().catch(() => undefined);
                  }}
                  style={({pressed}) => [
                    styles.composerActionButton,
                    {
                      opacity: isSending
                        ? 0.46
                        : pressed
                        ? actionMotion.pressedOpacity
                        : 1,
                    },
                  ]}>
                  <View
                    testID="circle-thread-composer-camera-circle"
                    style={[
                      styles.composerIconFace,
                      {backgroundColor: systemTheme.surface},
                    ]}>
                    <Camera
                      color={systemTheme.muted}
                      size={20}
                      strokeWidth={2.2}
                    />
                  </View>
                </Pressable>
                <Pressable
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                  accessibilityState={{disabled: !canSendMessage}}
                  disabled={!canSendMessage}
                  onPress={() => {
                    handleSend().catch(() => undefined);
                  }}
                  style={({pressed}) => [
                    styles.composerActionButton,
                    {
                      opacity: !canSendMessage
                        ? 0.46
                        : pressed
                        ? actionMotion.pressedOpacity
                        : 1,
                    },
                  ]}>
                  <View
                    style={styles.sendCircle}
                    testID="circle-thread-composer-send-circle">
                    <ArrowRight
                      color={brandColors.white}
                      size={20}
                      strokeWidth={2.7}
                    />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          {photoUri ? (
            <View style={styles.photoPreviewRow}>
              <Image
                resizeMode="cover"
                source={{uri: photoUri}}
                style={styles.photoPreview}
              />
              <Pressable
                accessibilityLabel="Remove selected photo"
                accessibilityRole="button"
                onPress={() => setPhotoUri(undefined)}
                style={[
                  styles.removePhotoButton,
                  {
                    backgroundColor: systemTheme.surface,
                    borderColor: systemTheme.border,
                  },
                ]}>
                <X color={systemTheme.text} size={14} strokeWidth={2.2} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.threadContent} testID="circle-thread-feed">
        {threadError && items.length === 0 ? (
          <View style={styles.stateCard} testID="circle-thread-error">
            <View style={styles.emptyCardContent}>
              <HoystText
                style={styles.emptyCardTitle}
                testID="circle-thread-error-title">
                Could not load Circle Feed
              </HoystText>
              <HoystText
                style={styles.emptyCardBody}
                testID="circle-thread-error-body"
                tone="muted">
                Your circle is connected, but Hoyst could not load the latest
                thread yet.
              </HoystText>
              <Pressable
                accessibilityLabel="Retry Circle Feed"
                accessibilityRole="button"
                onPress={handleRetry}
                style={({pressed}) => [
                  styles.retryButton,
                  {opacity: pressed ? actionMotion.pressedOpacity : 1},
                ]}>
                <HoystText style={styles.retryButtonLabel}>Try again</HoystText>
              </Pressable>
            </View>
          </View>
        ) : isInitialLoading ? (
          <View style={styles.loadingRow} testID="circle-thread-loading">
            <ActivityIndicator color={theme.accentTertiaryForeground} />
            <HoystText tone="muted" variant="caption">
              Loading Circle Feed...
            </HoystText>
          </View>
        ) : items.length > 0 ? (
          daySections.map(section => (
            <View key={section.dateKey} style={styles.daySection}>
              <View style={styles.dayMarkerRow}>
                <View
                  style={[
                    styles.dayMarkerLine,
                    {backgroundColor: theme.border},
                  ]}
                />
                <HoystText
                  style={styles.dayMarker}
                  testID={`circle-thread-day-${section.dateKey}`}
                  tone="muted">
                  {formatDayMarkerLabel(section.label)}
                </HoystText>
                <View
                  style={[
                    styles.dayMarkerLine,
                    {backgroundColor: theme.border},
                  ]}
                />
              </View>
              {section.items.map(item => (
                <ThreadItem
                  item={item}
                  key={item.id}
                  onLike={handleLike}
                  readOnly={isArchived}
                  onShareTapIn={onShareTapIn}
                  viewerUid={viewerUid}
                />
              ))}
            </View>
          ))
        ) : (
          <View style={styles.stateCard} testID="circle-thread-empty">
            <View style={styles.emptyCardContent}>
              <HoystText
                style={styles.emptyCardTitle}
                testID="circle-thread-empty-title">
                Start the Circle Feed
              </HoystText>
              <HoystText
                style={styles.emptyCardBody}
                testID="circle-thread-empty-body"
                tone="muted">
                Share a note or photo when the group needs momentum.
              </HoystText>
            </View>
          </View>
        )}

        {isLoadingMore ? (
          <View style={styles.loadingRow} testID="circle-thread-loading-more">
            <ActivityIndicator color={theme.accentTertiaryForeground} />
            <HoystText tone="muted" variant="caption">
              Loading older activity...
            </HoystText>
          </View>
        ) : threadError && items.length > 0 ? (
          <View style={styles.paginationError}>
            <HoystText tone="muted" variant="caption">
              Could not load older activity.
            </HoystText>
            <Pressable
              accessibilityLabel="Retry older circle activity"
              accessibilityRole="button"
              onPress={handleRetry}
              style={({pressed}) => [
                styles.retryButton,
                {opacity: pressed ? actionMotion.pressedOpacity : 1},
              ]}>
              <HoystText style={styles.retryButtonLabel}>Try again</HoystText>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  archivedFooter: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  archivedFooterCopy: {flex: 1, gap: 2},
  archivedFooterTitle: {fontSize: 15, fontWeight: '600', lineHeight: 20},
  composerActionCluster: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    height: 44,
    justifyContent: 'flex-end',
    position: 'absolute',
    right: 0,
    top: 2,
    width: 92,
    zIndex: 1,
  },
  composerActionButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexShrink: 0,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  composerAvatar: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  composerAvatarImage: {height: 40, width: 40},
  composerAvatarInitial: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  composerIconFace: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  composerInput: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
    maxHeight: 96,
    minHeight: 48,
    minWidth: 0,
    paddingHorizontal: 12,
    paddingRight: 104,
    paddingVertical: 12,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  composerInputShell: {
    borderRadius: 12,
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  composerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
  },
  composerSurface: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  dayMarker: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 16,
  },
  dayMarkerLine: {flex: 1, height: StyleSheet.hairlineWidth},
  dayMarkerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  daySection: {width: '100%'},
  emptyCardBody: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
  },
  emptyCardContent: {gap: 4, paddingVertical: 12},
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 21,
  },
  likeButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 4,
  },
  likeCount: {fontSize: 12, fontWeight: '600', lineHeight: 16},
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paginationError: {alignItems: 'center', gap: 8, paddingVertical: 10},
  photoPreview: {borderRadius: 12, height: 56, width: 56},
  photoPreviewRow: {
    alignSelf: 'flex-start',
    marginLeft: 48,
    position: 'relative',
  },
  removePhotoButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -7,
    top: -7,
    width: 24,
  },
  retryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 12,
  },
  retryButtonLabel: {
    color: brandColors.blueVivid,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  rowActions: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 0,
  },
  rowActor: {fontWeight: '600'},
  rowAvatar: {alignSelf: 'flex-start'},
  rowCopy: {flex: 1, gap: 2, minWidth: 0},
  rowMessage: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
  },
  rowNote: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
  },
  rowThumbnail: {borderRadius: 8, height: 36, width: 36},
  rowTimestamp: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 16,
  },
  section: {gap: 12, width: '100%'},
  sendCircle: {
    alignItems: 'center',
    backgroundColor: brandColors.blueVivid,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  shareTapInButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stateCard: {width: '100%'},
  threadContent: {width: '100%'},
  threadRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    width: '100%',
  },
});
