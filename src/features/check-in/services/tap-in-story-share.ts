import type {RefObject} from 'react';
import {NativeModules, TurboModuleRegistry, type View} from 'react-native';

import type {CircleDetailModel} from '../../../types/models';

export type TapInStoryShareStatus = 'done' | 'skip' | undefined;

export type TapInStoryShareData = {
  circleTitle: string;
  ctaLabel: string;
  commitment: string;
  hasInviteUrl: boolean;
  inviteUrl?: string;
  note: string;
  photoUri?: string;
  progressLabel: string;
  shareMessage: string;
  streakLabel: string;
};

type BuildTapInStoryShareDataInput = {
  detail?: CircleDetailModel;
  note?: string;
  photoUri?: string;
};

const fallbackCircleTitle = 'Hoyst Circle';
const fallbackCommitment = "Today's Tap In";
const fallbackNote = 'No note added. Still counted.';
const fallbackCtaLabel = 'Build your rhythm on Hoyst';
const unavailableMessage =
  'Story sharing is not available in this app build yet. Rebuild the app, then try again.';
let nativeModuleAvailabilityOverride: boolean | undefined;

function cleanText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function hasNativeModule(name: string) {
  if (nativeModuleAvailabilityOverride !== undefined) {
    return nativeModuleAvailabilityOverride;
  }

  const turboModule = TurboModuleRegistry.get?.(name);
  return Boolean(turboModule ?? NativeModules[name]);
}

export function setTapInStoryShareNativeModuleAvailabilityForTests(
  value: boolean | undefined,
) {
  nativeModuleAvailabilityOverride = value;
}

export function canShareTapInStory(status: TapInStoryShareStatus) {
  return status !== 'skip';
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
    note: cleanNote,
    photoUri,
    progressLabel,
    shareMessage,
    streakLabel,
  };
}

async function loadStoryShareModules() {
  if (!hasNativeModule('RNShare') || !hasNativeModule('RNViewShot')) {
    throw new Error(unavailableMessage);
  }

  try {
    const viewShotModule =
      require('react-native-view-shot') as typeof import('react-native-view-shot');
    const shareModule =
      require('react-native-share') as typeof import('react-native-share');

    return {
      captureRef: viewShotModule.captureRef,
      releaseCapture: viewShotModule.releaseCapture,
      shareOpen: shareModule.default.open,
    };
  } catch {
    throw new Error(unavailableMessage);
  }
}

export async function shareTapInStoryImage(
  storyCardRef: RefObject<View | null>,
  message: string,
) {
  let capturedUri: string | undefined;
  const {captureRef, releaseCapture, shareOpen} = await loadStoryShareModules();

  try {
    capturedUri = await captureRef(storyCardRef, {
      format: 'png',
      height: 1920,
      quality: 1,
      result: 'tmpfile',
      width: 1080,
    });

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
