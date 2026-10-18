import {
  normalizeCategory,
  readAppearance,
  type CommitmentAppearance,
} from '../../../shared/commitment-appearance';
import type {RefObject} from 'react';
import {
  NativeModules,
  PixelRatio,
  Platform,
  TurboModuleRegistry,
  type View,
} from 'react-native';
import type {ShareSingleOptions, Social} from 'react-native-share';

import type {
  CheckInStatus,
  CircleDetailModel,
  CircleMemberStatus,
  CommitmentType,
} from '../../../types/models';
import {DateTime} from 'luxon';
import {
  formatCircleStreak,
  type CircleProgressSummary,
} from '../../../shared/circle-progress';
import {formatCommitmentQuantity} from '../../commitments/commitment-goal-label';
import type {TapInStoryContext, TapInStoryMoment} from './tap-in-story-context';

export type TapInStoryShareStatus = Exclude<CheckInStatus, 'rest'> | undefined;
export type TapInStoryTemplateId = 'tapInMoment' | 'transparentOverlay';

export type TapInStoryProgress = {
  label: string;
  periodLabel: string;
  value: string;
  unitLabel?: string;
  streak: string;
};

export type TapInStoryShareData = {
  category: string;
  appearance?: CommitmentAppearance;
  circleTitle: string;
  circleMode: 'personal' | 'group';
  commitmentType?: CommitmentType;
  ctaLabel: string;
  commitment: string;
  hasInviteUrl: boolean;
  inviteUrl?: string;
  memberCount: number;
  members: CircleMemberStatus[];
  photoUri?: string;
  shareMessage: string;
  dateLabel: string;
  headerLabel: string;
  result: {statusLabel: string; quantityLabel?: string};
  personalProgress: TapInStoryProgress;
  groupProgress?: TapInStoryProgress;
};

type TapInStoryShareDetail = Pick<CircleDetailModel, 'commitment' | 'title'> &
  Partial<
    Pick<
      CircleDetailModel,
      | 'category'
      | 'appearance'
      | 'circleMode'
      | 'commitmentType'
      | 'commitmentCadence'
      | 'commitmentFrequency'
      | 'targetValue'
      | 'maximumValue'
      | 'minimumValue'
      | 'unitLabel'
      | 'buildTrackingMode'
      | 'inviteUrl'
      | 'memberCount'
      | 'members'
    >
  >;

type BuildTapInStoryShareDataInput = {
  detail?: TapInStoryShareDetail;
  tapIn?: TapInStoryMoment;
  context?: TapInStoryContext;
  photoUri?: string;
};

const fallbackCircleTitle = 'Hoyst Circle';
const fallbackCommitment = "Today's Tap In";
const unavailableMessage =
  'Story sharing is not available in this app build yet. Rebuild the app, then try again.';
const imageClipboardUnavailableMessage =
  'Image clipboard is not available in this app build yet. Rebuild the app, then try again.';
let nativeModuleAvailabilityOverride: boolean | undefined;

function storyCaptureOptions() {
  // iOS interprets dimensions as points; Android uses physical pixels.
  const density = Platform.OS === 'ios' ? PixelRatio.get() : 1;
  return {
    format: 'png',
    height: 1920 / density,
    quality: 1,
    result: 'tmpfile',
    width: 1080 / density,
  } as const;
}

function cleanText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function cleanCount(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function hasNativeModule(name: string) {
  if (nativeModuleAvailabilityOverride !== undefined) {
    return nativeModuleAvailabilityOverride;
  }

  const turboModule = TurboModuleRegistry.get?.(name);
  return Boolean(turboModule ?? NativeModules[name]);
}

type HoystClipboardImageModule = {
  copyImage: (uri: string) => Promise<boolean>;
};

export function setTapInStoryShareNativeModuleAvailabilityForTests(
  value: boolean | undefined,
) {
  nativeModuleAvailabilityOverride = value;
}

export function canShareTapInStory(status: TapInStoryShareStatus) {
  return status !== 'skip';
}

export function getAvailableTapInStoryTemplates(
  _story: TapInStoryShareData,
): TapInStoryTemplateId[] {
  return ['tapInMoment', 'transparentOverlay'];
}

export function getTapInStoryClipboardText(story: TapInStoryShareData) {
  if (!story.inviteUrl) {
    return story.shareMessage;
  }

  const baseMessage = story.shareMessage.replace(
    ` Join us: ${story.inviteUrl}`,
    '',
  );

  return `${baseMessage}\n${story.inviteUrl}`;
}

function storyProgress(
  summary: CircleProgressSummary | undefined,
  isGroup: boolean,
  tapInDate?: string,
): TapInStoryProgress {
  const periodDate = summary && DateTime.fromISO(summary.period.start);
  const periodEnd = summary && DateTime.fromISO(summary.period.end);
  const sameDay = tapInDate === summary?.asOfDateKey;
  const periodLabel =
    !summary || !periodDate?.isValid || !periodEnd?.isValid
      ? 'Current period'
      : sameDay
      ? summary.cadence === 'daily'
        ? 'Today'
        : summary.cadence === 'weekly'
        ? 'This week'
        : 'This month'
      : summary.cadence === 'daily'
      ? periodDate.toFormat('LLL d, yyyy')
      : `${periodDate.toFormat('LLL d')} to ${periodEnd.toFormat(
          'LLL d, yyyy',
        )}`;
  const known = summary && summary.progress.outcome !== 'unknown';
  const {covered = 0, required = 0} = summary?.progress ?? {};
  return {
    label: isGroup ? 'Group progress' : 'Your progress',
    periodLabel,
    value: !known
      ? 'Progress unavailable'
      : required === 0
      ? 'No eligible goal'
      : isGroup
      ? `${covered} of ${required} members met goal`
      : `${covered} of ${required}`,
    unitLabel: known && required > 0 && !isGroup ? 'Tap Ins' : undefined,
    streak: formatCircleStreak(summary?.streak),
  };
}

export function buildTapInStoryShareData({
  detail,
  tapIn,
  context,
  photoUri,
}: BuildTapInStoryShareDataInput): TapInStoryShareData {
  const circleTitle = cleanText(detail?.title, fallbackCircleTitle);
  const category = cleanText(detail?.category, 'General');
  const commitment = cleanText(detail?.commitment, fallbackCommitment);
  const personal = detail?.circleMode === 'personal';
  const moment = context?.tapIn ?? tapIn;
  const date = moment && DateTime.fromISO(moment.dateKey);
  const inviteUrl = personal
    ? undefined
    : detail?.inviteUrl?.trim() || undefined;
  const shareMessage = inviteUrl
    ? `I tapped in with ${circleTitle} on Hoyst. Join us: ${inviteUrl}`
    : `I tapped in with ${circleTitle} on Hoyst.`;
  const status = moment?.coverageStatus ?? moment?.status;
  const dateLabel = date?.isValid
    ? date.setLocale('en-US').toFormat('LLL d, yyyy')
    : 'Date unavailable';

  return {
    category: normalizeCategory(category),
    ...(detail?.appearance
      ? {appearance: readAppearance(detail.appearance)}
      : {}),
    circleTitle,
    circleMode: personal ? 'personal' : 'group',
    ...(detail?.commitmentType ? {commitmentType: detail.commitmentType} : {}),
    ctaLabel: personal
      ? 'Tapped in on Hoyst'
      : inviteUrl
      ? 'Join this Circle on Hoyst'
      : 'Tap in with Hoyst',
    commitment,
    hasInviteUrl: Boolean(inviteUrl),
    inviteUrl,
    memberCount: personal ? 0 : cleanCount(detail?.memberCount),
    members: personal
      ? []
      : detail?.members
          ?.filter(member => member.membershipStatus !== 'pending')
          .slice(0, 3) ?? [],
    photoUri,
    shareMessage,
    dateLabel,
    headerLabel: `${dateLabel.toUpperCase()} · I TAPPED IN ON MY ${
      personal ? 'PERSONAL COMMITMENT' : 'ACCOUNTABILITY CIRCLE'
    }:`,
    result: {
      statusLabel:
        status === 'done' || status === 'covered'
          ? 'Goal met'
          : status === 'partial'
          ? 'Partial'
          : status === 'failed'
          ? 'Goal not met'
          : status === 'skip' || status === 'skipped'
          ? 'Protected'
          : 'Result unavailable',
      quantityLabel:
        typeof moment?.currentValue === 'number' &&
        Number.isFinite(moment.currentValue)
          ? formatCommitmentQuantity(
              moment.currentValue,
              moment.unitLabel?.trim() || detail?.unitLabel || 'unit',
            )
          : undefined,
    },
    personalProgress: storyProgress(
      context?.progress?.viewer,
      false,
      moment?.dateKey,
    ),
    ...(!personal
      ? {
          groupProgress: storyProgress(
            context?.progress?.group,
            true,
            moment?.dateKey,
          ),
        }
      : {}),
  };
}

async function loadViewShotModule() {
  if (!hasNativeModule('RNViewShot')) {
    throw new Error(unavailableMessage);
  }

  try {
    const viewShotModule =
      require('react-native-view-shot') as typeof import('react-native-view-shot');

    return {
      captureRef: viewShotModule.captureRef,
      releaseCapture: viewShotModule.releaseCapture,
    };
  } catch {
    throw new Error(unavailableMessage);
  }
}

async function loadShareModule() {
  if (!hasNativeModule('RNShare')) {
    throw new Error(unavailableMessage);
  }

  try {
    const shareModule =
      require('react-native-share') as typeof import('react-native-share');

    return {
      shareOpen: shareModule.default.open,
      shareSingle: shareModule.default.shareSingle,
      social: shareModule.default.Social,
    };
  } catch {
    throw new Error(unavailableMessage);
  }
}

async function loadStoryShareModules() {
  const viewShotModule = await loadViewShotModule();
  const shareModule = await loadShareModule();

  return {
    ...viewShotModule,
    ...shareModule,
  };
}

function getImageClipboardModule(): HoystClipboardImageModule {
  if (!hasNativeModule('HoystClipboardImage')) {
    throw new Error(imageClipboardUnavailableMessage);
  }

  const turboModule = TurboModuleRegistry.get?.('HoystClipboardImage');
  const nativeModule = turboModule ?? NativeModules.HoystClipboardImage;

  if (
    nativeModule &&
    typeof (nativeModule as HoystClipboardImageModule).copyImage === 'function'
  ) {
    return nativeModule as HoystClipboardImageModule;
  }

  throw new Error(imageClipboardUnavailableMessage);
}

export async function captureTapInStoryImage(
  storyCardRef: RefObject<View | null>,
) {
  const {captureRef} = await loadViewShotModule();
  return captureRef(storyCardRef, storyCaptureOptions());
}

export async function releaseTapInStoryImage(capturedUri: string) {
  const {releaseCapture} = await loadViewShotModule();
  releaseCapture(capturedUri);
}

export async function copyTapInStoryImageToClipboard(
  storyCardRef: RefObject<View | null>,
) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture} = await loadViewShotModule();
  const imageClipboard = getImageClipboardModule();

  try {
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions());
    await imageClipboard.copyImage(capturedUri);
  } finally {
    if (capturedUri) {
      releaseCapture(capturedUri);
    }
  }
}

export async function shareTapInStoryImage(
  storyCardRef: RefObject<View | null>,
  message: string,
  canOpenShare?: () => boolean,
) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture, shareOpen} = await loadStoryShareModules();

  try {
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions());

    if (canOpenShare && !canOpenShare()) {
      throw new Error('Your account changed. Reopen the share preview.');
    }

    await shareOpen({
      failOnCancel: false,
      message,
      type: 'image/png',
      url: capturedUri,
    });
  } finally {
    if (capturedUri) {
      releaseCapture(capturedUri);
    }
  }
}

type ShareTapInStorySocialInput = {
  appId?: string;
  inviteUrl?: string;
  message: string;
  storyCardRef: RefObject<View | null>;
  templateId: TapInStoryTemplateId;
};

async function shareCapturedViaOpen(capturedUri: string, message: string) {
  const {shareOpen} = await loadStoryShareModules();

  await shareOpen({
    failOnCancel: false,
    message,
    type: 'image/png',
    url: capturedUri,
  });
}

export async function shareTapInStoryToInstagram({
  appId,
  inviteUrl,
  message,
  storyCardRef,
  templateId,
}: ShareTapInStorySocialInput) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture, shareSingle, social} =
    await loadStoryShareModules();

  try {
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions());

    if (!appId || !social?.INSTAGRAM_STORIES) {
      await shareCapturedViaOpen(capturedUri, message);
      return;
    }

    const storyAssetOptions =
      templateId === 'transparentOverlay'
        ? {
            backgroundBottomColor: '#000000',
            backgroundTopColor: '#000000',
            stickerImage: capturedUri,
          }
        : {
            backgroundImage: capturedUri,
          };

    try {
      await shareSingle({
        appId,
        attributionURL: inviteUrl,
        linkText: inviteUrl ? 'Join this Circle on Hoyst' : undefined,
        linkUrl: inviteUrl,
        social: social.INSTAGRAM_STORIES as Social,
        ...storyAssetOptions,
      });
    } catch {
      await shareCapturedViaOpen(capturedUri, message);
    }
  } finally {
    if (capturedUri) {
      releaseCapture(capturedUri);
    }
  }
}

export async function shareTapInStoryToSnapchat({
  message,
  storyCardRef,
}: ShareTapInStorySocialInput) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture, shareSingle, social} =
    await loadStoryShareModules();

  try {
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions());

    if (!social?.SNAPCHAT) {
      await shareCapturedViaOpen(capturedUri, message);
      return;
    }

    try {
      await shareSingle({
        message,
        social: social.SNAPCHAT as Social,
        type: 'image/png',
        url: capturedUri,
      } as ShareSingleOptions);
    } catch {
      await shareCapturedViaOpen(capturedUri, message);
    }
  } finally {
    if (capturedUri) {
      releaseCapture(capturedUri);
    }
  }
}
