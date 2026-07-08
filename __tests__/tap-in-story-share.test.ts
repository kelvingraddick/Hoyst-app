const mockCaptureRef = jest.fn();
const mockReleaseCapture = jest.fn();
const mockShareOpen = jest.fn();
const mockShareSingle = jest.fn();
const mockCopyImage = jest.fn();

jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
  releaseCapture: (...args: unknown[]) => mockReleaseCapture(...args),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: (...args: unknown[]) => mockShareOpen(...args),
    shareSingle: (...args: unknown[]) => mockShareSingle(...args),
    Social: {
      INSTAGRAM_STORIES: 'instagramstories',
      SNAPCHAT: 'snapchat',
    },
  },
}));

import {
  buildTapInStoryShareData,
  canShareTapInStory,
  copyTapInStoryImageToClipboard,
  getAvailableTapInStoryTemplates,
  getTapInStoryClipboardText,
  setTapInStoryShareNativeModuleAvailabilityForTests,
  shareTapInStoryImage,
  shareTapInStoryToInstagram,
  shareTapInStoryToSnapchat,
} from '../src/features/check-in/services/tap-in-story-share';
import type {RefObject} from 'react';
import {NativeModules} from 'react-native';
import type {CircleDetailModel} from '../src/types/models';

const detail = {
  activity: [],
  category: 'Wellness',
  completionRate: 82,
  commitmentLabel: 'Commitment: Move for 20 minutes',
  commitment: 'Move for 20 minutes',
  commitmentCadence: 'daily',
  id: 'circle-1',
  inviteUrl: 'https://hoyst.app/invite/circle-1',
  maxSize: 12,
  memberCount: 7,
  members: [],
  monthProgress: [],
  periodTapInCount: 23,
  progressPercent: 82,
  progressLabel: 'Today · 82%',
  remainingCheckIns: 1,
  state: 'active',
  streakDays: 6,
  streakLabel: '6 day streak',
  title: 'Morning Movers',
  viewerHasCheckedIn: true,
} satisfies CircleDetailModel;

describe('Tap In story sharing', () => {
  beforeEach(() => {
    mockCaptureRef.mockReset();
    mockReleaseCapture.mockReset();
    mockShareOpen.mockReset();
    mockShareSingle.mockReset();
    mockCopyImage.mockReset();
    mockCaptureRef.mockResolvedValue('file:///tmp/hoyst-story.png');
    mockShareOpen.mockResolvedValue({message: 'shared', success: true});
    mockShareSingle.mockResolvedValue({message: 'shared', success: true});
    mockCopyImage.mockResolvedValue(true);
    NativeModules.HoystClipboardImage = {
      copyImage: (...args: unknown[]) => mockCopyImage(...args),
    };
    setTapInStoryShareNativeModuleAvailabilityForTests(true);
  });

  afterEach(() => {
    delete NativeModules.HoystClipboardImage;
    setTapInStoryShareNativeModuleAvailabilityForTests(undefined);
  });

  it('shows story sharing for completed Tap Ins but not skips', () => {
    expect(canShareTapInStory('done')).toBe(true);
    expect(canShareTapInStory(undefined)).toBe(true);
    expect(canShareTapInStory('skip')).toBe(false);
  });

  it('builds story data with invite CTA and attached Tap In details', () => {
    const story = buildTapInStoryShareData({
      detail,
      note: 'Finished the set before breakfast.',
      photoUri: 'file:///tmp/proof.jpg',
    });

    expect(story).toEqual({
      circleTitle: 'Morning Movers',
      ctaLabel: 'Join this Circle on Hoyst',
      commitment: 'Move for 20 minutes',
      hasInviteUrl: true,
      inviteUrl: 'https://hoyst.app/invite/circle-1',
      memberCount: 7,
      note: 'Finished the set before breakfast.',
      periodTapInCount: 23,
      photoUri: 'file:///tmp/proof.jpg',
      progressLabel: 'Today · 82%',
      shareMessage:
        'I tapped in with Morning Movers on Hoyst. Join us: https://hoyst.app/invite/circle-1',
      streakDays: 6,
      streakLabel: '6d streak',
    });
  });

  it('returns story templates based on whether a Tap In photo exists', () => {
    const storyWithPhoto = buildTapInStoryShareData({
      detail,
      photoUri: 'file:///tmp/proof.jpg',
    });
    const storyWithoutPhoto = buildTapInStoryShareData({detail});

    expect(getAvailableTapInStoryTemplates(storyWithPhoto)).toEqual([
      'photoOverlay',
      'designedPost',
      'transparentStats',
    ]);
    expect(getAvailableTapInStoryTemplates(storyWithoutPhoto)).toEqual([
      'designedPost',
      'transparentStats',
    ]);
  });

  it('builds clean clipboard text with the invite link on its own line', () => {
    const story = buildTapInStoryShareData({detail});

    expect(getTapInStoryClipboardText(story)).toBe(
      'I tapped in with Morning Movers on Hoyst.\nhttps://hoyst.app/invite/circle-1',
    );
  });

  it('uses a Hoyst fallback CTA when no invite URL is available', () => {
    const story = buildTapInStoryShareData({
      detail: {...detail, inviteUrl: undefined},
      note: '',
    });

    expect(story.hasInviteUrl).toBe(false);
    expect(story.inviteUrl).toBeUndefined();
    expect(story.ctaLabel).toBe('Build your rhythm on Hoyst');
    expect(story.note).toBe('No note added. Still counted.');
    expect(story.shareMessage).toBe(
      'I tapped in with Morning Movers on Hoyst.',
    );
  });

  it('captures, shares, and releases the temporary story image', async () => {
    const ref = {current: {}} as RefObject<never>;

    await shareTapInStoryImage(ref, 'Story message');

    expect(mockCaptureRef).toHaveBeenCalledWith(ref, {
      format: 'png',
      height: 1920,
      quality: 1,
      result: 'tmpfile',
      width: 1080,
    });
    expect(mockShareOpen).toHaveBeenCalledWith({
      failOnCancel: false,
      message: 'Story message',
      type: 'image/png',
      url: 'file:///tmp/hoyst-story.png',
    });
    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('captures, copies, and releases the temporary story image for clipboard', async () => {
    const ref = {current: {}} as RefObject<never>;

    await copyTapInStoryImageToClipboard(ref);

    expect(mockCaptureRef).toHaveBeenCalledWith(ref, {
      format: 'png',
      height: 1920,
      quality: 1,
      result: 'tmpfile',
      width: 1080,
    });
    expect(mockCopyImage).toHaveBeenCalledWith('file:///tmp/hoyst-story.png');
    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('shares generated story images directly to Instagram Stories', async () => {
    const ref = {current: {}} as RefObject<never>;

    await shareTapInStoryToInstagram({
      appId: 'instagram-app-id',
      inviteUrl: detail.inviteUrl,
      message: 'Story message',
      storyCardRef: ref,
      templateId: 'designedPost',
    });

    expect(mockShareSingle).toHaveBeenCalledWith({
      appId: 'instagram-app-id',
      attributionURL: detail.inviteUrl,
      backgroundImage: 'file:///tmp/hoyst-story.png',
      linkText: 'Join this Circle on Hoyst',
      linkUrl: detail.inviteUrl,
      social: 'instagramstories',
    });
    expect(mockShareOpen).not.toHaveBeenCalled();
    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('shares transparent stats to Instagram Stories as a sticker image', async () => {
    const ref = {current: {}} as RefObject<never>;

    await shareTapInStoryToInstagram({
      appId: 'instagram-app-id',
      inviteUrl: undefined,
      message: 'Story message',
      storyCardRef: ref,
      templateId: 'transparentStats',
    });

    expect(mockShareSingle).toHaveBeenCalledWith({
      appId: 'instagram-app-id',
      attributionURL: undefined,
      backgroundBottomColor: '#000000',
      backgroundTopColor: '#000000',
      linkText: undefined,
      linkUrl: undefined,
      social: 'instagramstories',
      stickerImage: 'file:///tmp/hoyst-story.png',
    });
    expect(mockShareOpen).not.toHaveBeenCalled();
  });

  it('shares captured story images directly to Snapchat', async () => {
    const ref = {current: {}} as RefObject<never>;

    await shareTapInStoryToSnapchat({
      inviteUrl: detail.inviteUrl,
      message: 'Story message',
      storyCardRef: ref,
      templateId: 'designedPost',
    });

    expect(mockShareSingle).toHaveBeenCalledWith({
      message: 'Story message',
      social: 'snapchat',
      type: 'image/png',
      url: 'file:///tmp/hoyst-story.png',
    });
    expect(mockShareOpen).not.toHaveBeenCalled();
    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('falls back to the generic share sheet when Instagram app id is missing', async () => {
    const ref = {current: {}} as RefObject<never>;

    await shareTapInStoryToInstagram({
      appId: '',
      inviteUrl: detail.inviteUrl,
      message: 'Story message',
      storyCardRef: ref,
      templateId: 'designedPost',
    });

    expect(mockShareSingle).not.toHaveBeenCalled();
    expect(mockShareOpen).toHaveBeenCalledWith({
      failOnCancel: false,
      message: 'Story message',
      type: 'image/png',
      url: 'file:///tmp/hoyst-story.png',
    });
    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('releases the temporary image if sharing fails', async () => {
    const ref = {current: {}} as RefObject<never>;
    mockShareOpen.mockRejectedValue(new Error('share failed'));

    await expect(shareTapInStoryImage(ref, 'Story message')).rejects.toThrow(
      'share failed',
    );

    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });

  it('releases the temporary image if copying to clipboard fails', async () => {
    const ref = {current: {}} as RefObject<never>;
    mockCopyImage.mockRejectedValue(new Error('copy failed'));

    await expect(copyTapInStoryImageToClipboard(ref)).rejects.toThrow(
      'copy failed',
    );

    expect(mockReleaseCapture).toHaveBeenCalledWith(
      'file:///tmp/hoyst-story.png',
    );
  });
});
