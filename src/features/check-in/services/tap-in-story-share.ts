import type {RefObject} from 'react';
import {NativeModules, TurboModuleRegistry, type View} from 'react-native';
import type {ShareSingleOptions, Social} from 'react-native-share';

import type {CheckInStatus, CircleDetailModel} from '../../../types/models';

export type TapInStoryShareStatus = Exclude<CheckInStatus, 'rest'> | undefined;
export type TapInStoryTemplateId =
  | 'designedPost'
  | 'photoOverlay'
  | 'transparentStats';

export type TapInStoryShareData = {
  circleTitle: string;
  ctaLabel: string;
  commitment: string;
  hasInviteUrl: boolean;
  inviteUrl?: string;
  memberCount: number;
  note: string;
  periodTapInCount: number;
  photoUri?: string;
  progressLabel: string;
  shareMessage: string;
  streakDays: number;
  streakLabel: string;
};

type TapInStoryShareDetail = Pick<CircleDetailModel, 'commitment' | 'title'> &
  Partial<
    Pick<
      CircleDetailModel,
      | 'completionRate'
      | 'inviteUrl'
      | 'memberCount'
      | 'periodTapInCount'
      | 'progressLabel'
      | 'streakDays'
      | 'streakLabel'
    >
  >;

type BuildTapInStoryShareDataInput = {
  detail?: TapInStoryShareDetail;
  note?: string;
  photoUri?: string;
};

const fallbackCircleTitle = 'Hoyst Circle';
const fallbackCommitment = "Today's Tap In";
const fallbackNote = 'No note added. Still counted.';
const fallbackCtaLabel = 'Build your Progress on Hoyst';
const unavailableMessage =
  'Story sharing is not available in this app build yet. Rebuild the app, then try again.';
const imageClipboardUnavailableMessage =
  'Image clipboard is not available in this app build yet. Rebuild the app, then try again.';
let nativeModuleAvailabilityOverride: boolean | undefined;

const storyCaptureOptions = {
  format: 'png',
  height: 1920,
  quality: 1,
  result: 'tmpfile',
  width: 1080,
} as const;

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
  story: TapInStoryShareData,
): TapInStoryTemplateId[] {
  const templates: TapInStoryTemplateId[] = [
    'designedPost',
    'transparentStats',
  ];

  if (story.photoUri) {
    return ['photoOverlay', ...templates];
  }

  return templates;
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

export function buildTapInStoryShareData({
  detail,
  note,
  photoUri,
}: BuildTapInStoryShareDataInput): TapInStoryShareData {
  const circleTitle = cleanText(detail?.title, fallbackCircleTitle);
  const commitment = cleanText(detail?.commitment, fallbackCommitment);
  const cleanNote = cleanText(note, fallbackNote);
  const progressLabel =
    cleanText(detail?.progressLabel, '') ||
    (typeof detail?.completionRate === 'number'
      ? `${detail.completionRate}% tapped in`
      : 'Tapped in today');
  const streakLabel =
    typeof detail?.streakDays === 'number' && detail.streakDays > 0
      ? `${detail.streakDays}d streak`
      : cleanText(detail?.streakLabel, 'Momentum saved');
  const streakDays = cleanCount(detail?.streakDays);
  const memberCount = cleanCount(detail?.memberCount);
  const periodTapInCount = cleanCount(detail?.periodTapInCount);
  const inviteUrl = detail?.inviteUrl?.trim() || undefined;
  const ctaLabel = inviteUrl ? 'Join this Circle on Hoyst' : fallbackCtaLabel;
  const shareMessage = inviteUrl
    ? `I tapped in with ${circleTitle} on Hoyst. Join us: ${inviteUrl}`
    : `I tapped in with ${circleTitle} on Hoyst.`;

  return {
    circleTitle,
    ctaLabel,
    commitment,
    hasInviteUrl: Boolean(inviteUrl),
    inviteUrl,
    memberCount,
    note: cleanNote,
    periodTapInCount,
    photoUri,
    progressLabel,
    shareMessage,
    streakDays,
    streakLabel,
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
  return captureRef(storyCardRef, storyCaptureOptions);
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
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions);
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
) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture, shareOpen} = await loadStoryShareModules();

  try {
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions);

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
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions);

    if (!appId || !social?.INSTAGRAM_STORIES) {
      await shareCapturedViaOpen(capturedUri, message);
      return;
    }

    const storyAssetOptions =
      templateId === 'transparentStats'
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
    capturedUri = await captureRef(storyCardRef, storyCaptureOptions);

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
