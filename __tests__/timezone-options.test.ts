import {
  getTimezoneOffsetLabel,
  getTimezonePickerOptions,
} from '../src/features/auth/services/timezone-options';

describe('timezone setup formatting', () => {
  it('uses the winter and summer offset for New York', () => {
    expect(
      getTimezoneOffsetLabel(
        'America/New_York',
        new Date('2026-01-15T12:00:00.000Z'),
      ),
    ).toBe('UTC-05:00');
    expect(
      getTimezoneOffsetLabel(
        'America/New_York',
        new Date('2026-07-15T12:00:00.000Z'),
      ),
    ).toBe('UTC-04:00');
  });

  it('formats UTC and fractional offsets reliably', () => {
    const date = new Date('2026-07-15T12:00:00.000Z');

    expect(getTimezoneOffsetLabel('UTC', date)).toBe('UTC');
    expect(getTimezoneOffsetLabel('Asia/Katmandu', date)).toBe('UTC+05:45');
  });

  it('builds friendly labels instead of raw timezone values', () => {
    const option = getTimezonePickerOptions({
      currentTimezone: 'America/New_York',
      localTimezone: 'America/New_York',
      now: new Date('2026-07-15T12:00:00.000Z'),
    }).find(item => item.id === 'America/New_York');

    expect(option?.label).toBe('Eastern Time (UTC-04:00)');
  });
});
