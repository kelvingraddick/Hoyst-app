const mockCaptureRef = jest.fn();
const mockReleaseCapture = jest.fn();
const mockShareOpen = jest.fn();

jest.mock('react-native-view-shot', () => ({
  captureRef: (...args: unknown[]) => mockCaptureRef(...args),
  releaseCapture: (...args: unknown[]) => mockReleaseCapture(...args),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    open: (...args: unknown[]) => mockShareOpen(...args),
  },
}));

import {
  buildTapInStoryShareData,
  canShareTapInStory,
  setTapInStoryShareNativeModuleAvailabilityForTests,
  shareTapInStoryImage,
} from '../src/features/check-in/services/tap-in-story-share';
import type {RefObject} from 'react';
import type {CircleDetailModel} from '../src/types/models';

const detail = {
  activity: [],
  category: 'Wellness',
  completionRate: 82,
  commitmentLabel: 'Commitment: Move for 20 minutes',
  commitment: 'Move for 20 minutes',
  id: 'circle-1',
  inviteUrl: 'https://hoyst.app/invite/circle-1',
  maxSize: 12,
  memberCount: 7,
  members: [],
  monthProgress: [],
  progressPercent: 82,
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
    mockCaptureRef.mockResolvedValue('file:///tmp/hoyst-story.png');
    mockShareOpen.mockResolvedValue({message: 'shared', success: true});
    setTapInStoryShareNativeModuleAvailabilityForTests(true);
  });

  afterEach(() => {
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
      note: 'Finished the set before breakfast.',
      photoUri: 'file:///tmp/proof.jpg',
      progressLabel: '82% tapped in',
      shareMessage:
        'I tapped in with Morning Movers on Hoyst. Join us: https://hoyst.app/invite/circle-1',
      streakLabel: '6d streak',
    });
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
});
