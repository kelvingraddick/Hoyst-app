import {recordNudgeCompletion} from '../functions/src/circles/nudge-completion';

describe('persisted Home nudge completion', () => {
  const sentAt = new Date('2026-09-08T00:01:00Z');
  const member = {path: 'circles/a/members/sender'};
  const set = jest.fn();
  const get = jest.fn();
  const db = {runTransaction: jest.fn(async callback => callback({get, set}))};
  const record = (nudged: number) =>
    recordNudgeCompletion(db as never, member as never, nudged, sentAt);
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockResolvedValue({exists: true, data: () => ({status: 'active'})});
  });
  it('does not award credit for zero targets', async () => {
    await record(0);
    expect(db.runTransaction).not.toHaveBeenCalled();
  });
  it('adds one sender receipt after a successful multi-member send', async () => {
    await record(3);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      member,
      {lastNudgedAt: sentAt},
      {merge: true},
    );
  });
  it('replaces an older receipt so the next local day can earn credit', async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({
        lastNudgedAt: {toDate: () => new Date('2026-09-07T23:59:00Z')},
      }),
    });
    await record(1);
    expect(set).toHaveBeenCalledTimes(1);
  });
  it('does not overwrite a later concurrent receipt', async () => {
    get.mockResolvedValue({
      exists: true,
      data: () => ({
        lastNudgedAt: {toDate: () => new Date('2026-09-08T00:02:00Z')},
      }),
    });
    await record(1);
    expect(set).not.toHaveBeenCalled();
  });
  it('does not recreate a removed membership', async () => {
    get.mockResolvedValue({exists: false, data: () => undefined});
    await record(1);
    expect(set).not.toHaveBeenCalled();
  });
  it('propagates persistence failures so the client cannot credit success', async () => {
    get.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(record(1)).rejects.toThrow('Unavailable');
    expect(set).not.toHaveBeenCalled();
  });
});
