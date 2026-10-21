import {Alert, Linking} from 'react-native';
import {
  chooseFeedbackContact,
  feedbackEmailUrl,
  openFeedbackContact,
} from '../src/features/beta/services/feedback-contact';
const mockCopy = jest.fn();
const mockTrack = jest.fn();
jest.mock('../src/lib/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrack(...args),
}));
jest.mock('../src/features/settings/services/app-info', () => ({
  getInstalledAppInfo: () => ({version: '1.0', build: '51'}),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {setString: (...args: unknown[]) => mockCopy(...args)},
}));
beforeEach(() => {
  jest.clearAllMocks();
});
it('offers separate support/feature intents and keeps email context in drafts', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  chooseFeedbackContact('feature');
  expect(alert).toHaveBeenCalledWith(
    'Request a feature',
    expect.stringContaining('send a DM'),
    expect.arrayContaining([expect.objectContaining({text: 'Email Hoyst'})]),
  );
  expect(decodeURIComponent(feedbackEmailUrl('support'))).toContain(
    'Steps to reproduce',
  );
  expect(decodeURIComponent(feedbackEmailUrl('feature'))).toContain('1.0 (51)');
});
it('counts opened routes, never counts a failed launch as sent feedback, and offers copy fallback', async () => {
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('no mail app'));
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await openFeedbackContact('feature', 'instagram');
  expect(open).toHaveBeenCalledWith('https://www.instagram.com/kg.codes/');
  expect(mockTrack).toHaveBeenCalledWith('feedback_contact_opened', {
    intent: 'feature',
    channel: 'instagram',
  });
  await openFeedbackContact('support', 'email');
  expect(mockTrack).toHaveBeenCalledTimes(1);
  alert.mock.calls
    .at(-1)![2]!
    .find(choice => choice.text === 'Copy email address')!
    .onPress?.();
  expect(mockCopy).toHaveBeenCalledWith('development@wavelinkllc.com');
});
