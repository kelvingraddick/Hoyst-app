import {
  awardXP,
  availableMilestones,
  earningWindow,
  grant,
  levelProgress,
  levelRewards,
  refundPurchase,
  refundSpend,
  spend,
  starterWallet,
} from '../functions/src/progress/model';
import {
  restoreCandidate,
  type RestoreSlot,
} from '../functions/src/progress/restores-model';
import {verifyWebhook} from '../functions/src/progress/purchases-model';
import {createHmac} from 'node:crypto';
describe('Progress economy', () => {
  test.each([
    [0, 1, 0, 70],
    [69, 1, 69, 1],
    [70, 2, 0, 70],
    [210, 4, 0, 70],
    [700, 11, 0, 70],
  ])('derives XP %i', (totalXP, level, levelXP, remainingXP) =>
    expect(levelProgress(totalXP)).toEqual({
      level,
      levelXP,
      remainingXP,
      requiredXP: 70,
    }),
  );
  it('grants every crossed level and every third restore', () => {
    expect(levelRewards(69, 490)).toEqual({skips: 7, restores: 2});
    const wallet = starterWallet(0);
    awardXP(wallet, 'bonus', 210);
    expect(wallet.inventory).toEqual({skips: 6, restores: 2});
  });
  it('spending and buying never alter XP', () => {
    const wallet = starterWallet(0);
    grant(wallet, 'paid', {skips: 5, restores: 2}, true);
    spend(wallet, 'skips');
    spend(wallet, 'restores');
    expect(wallet.totalXP).toBe(0);
  });
  it('rejects exhausted inventory without going negative', () => {
    const wallet = starterWallet(0);
    for (let i = 0; i < 3; i++) spend(wallet, 'skips');
    expect(() => spend(wallet, 'skips')).toThrow();
    expect(wallet.inventory.skips).toBe(0);
  });
  it('returns the original open token and revokes only unused paid units', () => {
    const wallet = starterWallet(0);
    for (let i = 0; i < 3; i++) spend(wallet, 'skips');
    grant(wallet, 'paid', {skips: 3, restores: 1}, true);
    const lot = spend(wallet, 'skips');
    expect(lot).toBe('paid');
    refundSpend(wallet, lot, 'skips');
    spend(wallet, 'skips');
    expect(refundPurchase(wallet, 'paid')).toEqual({skips: 2, restores: 1});
    expect(wallet.inventory.skips).toBe(0);
    expect(refundSpend(wallet, lot, 'skips', wallet.lots[lot].revoked)).toBe(
      false,
    );
  });
  it('holds the earning timezone until its window closes', () => {
    const now = Date.parse('2026-03-08T06:30:00Z');
    const window = earningWindow(now, 'America/New_York');
    window.earned = 30;
    expect(window.closesAt).toBe(Date.parse('2026-03-09T04:00:00Z'));
    expect(earningWindow(now + 3600000, 'Asia/Tokyo', window)).toBe(window);
    const next = earningWindow(window.closesAt, 'Asia/Tokyo', window);
    expect(next.timezone).toBe('Asia/Tokyo');
    expect(next.earned).toBe(0);
  });
  it('emits all reached milestone thresholds', () =>
    expect(
      availableMilestones(30, 50, 'peak_momentum').map(item => item.xp),
    ).toEqual([10, 20, 30, 50, 20, 30, 50]));
});
function slot(day: number, status: string): RestoreSlot {
  return {
    id: String(day),
    circleId: 'c',
    availableDateKey: `2026-09-${day}`,
    expiresDateKey: `2026-09-${day}`,
    periodKey: 'p',
    slotIndex: day,
    timezone: 'UTC',
    status,
  };
}
describe('historical restore selection', () => {
  it('reconnects a single missed gap without fabricating completed Tap Ins', () => {
    const choice = restoreCandidate(
      [slot(20, 'completed'), slot(21, 'missed'), slot(22, 'completed')],
      '2026-09-23',
    );
    expect(choice?.slot.status).toBe('missed');
    expect(choice?.resultingStreak).toBe(3);
  });
  it('rejects adjacent gaps and a missing prior streak', () => {
    expect(
      restoreCandidate(
        [slot(20, 'completed'), slot(21, 'missed'), slot(22, 'missed')],
        '2026-09-23',
      ),
    ).toBeUndefined();
    expect(
      restoreCandidate([slot(22, 'missed')], '2026-09-23'),
    ).toBeUndefined();
  });
  it('does not repair an opportunity that is still open', () =>
    expect(
      restoreCandidate(
        [slot(20, 'completed'), slot(21, 'available')],
        '2026-09-21',
      ),
    ).toBeUndefined());
  it('rejects unknown recent history even when an ancient gap was recorded', () => {
    expect(
      restoreCandidate(
        [slot(20, 'completed'), slot(21, 'missed')],
        '2026-09-30',
      ),
    ).toBeUndefined();
  });
  it('stops the prior streak at missing old history without rejecting a recent reconnectable gap', () => {
    expect(
      restoreCandidate(
        [
          slot(16, 'completed'),
          slot(20, 'completed'),
          slot(21, 'missed'),
          slot(22, 'completed'),
        ],
        '2026-09-23',
      )?.resultingStreak,
    ).toBe(3);
  });
  it('chooses only the latest gap', () =>
    expect(
      restoreCandidate(
        [
          slot(20, 'completed'),
          slot(21, 'missed'),
          slot(22, 'completed'),
          slot(23, 'missed'),
        ],
        '2026-09-24',
      )?.slot.id,
    ).toBe('23'));
});
describe('signed purchase webhooks', () => {
  const raw = Buffer.from('{"event":{"id":"1"}}');
  const secret = 'test secret';
  const now = 1700000000000;
  const signature = createHmac('sha256', secret)
    .update('1700000000.')
    .update(raw)
    .digest('hex');
  it('accepts valid signatures', () =>
    expect(
      verifyWebhook(raw, `t=1700000000,v1=${signature}`, secret, now),
    ).toBe(true));
  it('rejects body tampering, stale timestamps, and malformed signatures', () => {
    expect(
      verifyWebhook(
        Buffer.from('{}'),
        `t=1700000000,v1=${signature}`,
        secret,
        now,
      ),
    ).toBe(false);
    expect(
      verifyWebhook(raw, `t=1700000000,v1=${signature}`, secret, now + 301000),
    ).toBe(false);
    expect(verifyWebhook(raw, 't=1700000000,v1=no', secret, now)).toBe(false);
  });
});
describe('restore cadence continuity', () => {
  const make = (
    id: string,
    start: string,
    end: string,
    period: string,
    index: number,
    cadence: string,
    status: string,
  ): RestoreSlot => ({
    id,
    circleId: 'c',
    availableDateKey: start,
    expiresDateKey: end,
    periodKey: period,
    slotIndex: index,
    timezone: 'UTC',
    cadence,
    opportunitiesPerPeriod: 2,
    status,
  });
  it('repairs the original weekly slot', () => {
    const choice = restoreCandidate(
      [
        make(
          '1',
          '2026-09-14',
          '2026-09-16',
          '2026-09-14',
          0,
          'weekly',
          'completed',
        ),
        make(
          '2',
          '2026-09-17',
          '2026-09-20',
          '2026-09-14',
          1,
          'weekly',
          'missed',
        ),
        make(
          '3',
          '2026-09-21',
          '2026-09-23',
          '2026-09-21',
          0,
          'weekly',
          'completed',
        ),
      ],
      '2026-09-24',
    );
    expect(choice?.slot.id).toBe('2');
    expect(choice?.slot.periodKey).toBe('2026-09-14');
    expect(choice?.resultingStreak).toBe(3);
  });
  it('repairs a monthly slot across period boundaries', () => {
    const choice = restoreCandidate(
      [
        make(
          '1',
          '2026-08-01',
          '2026-08-15',
          '2026-08',
          0,
          'monthly',
          'completed',
        ),
        make(
          '2',
          '2026-08-16',
          '2026-08-31',
          '2026-08',
          1,
          'monthly',
          'missed',
        ),
        make(
          '3',
          '2026-09-01',
          '2026-09-15',
          '2026-09',
          0,
          'monthly',
          'completed',
        ),
      ],
      '2026-09-16',
    );
    expect(choice?.slot.expiresDateKey).toBe('2026-08-31');
    expect(choice?.resultingStreak).toBe(3);
  });
  it('rejects unrecorded intervening periods', () =>
    expect(
      restoreCandidate(
        [
          make(
            '1',
            '2026-06-16',
            '2026-06-30',
            '2026-06',
            1,
            'monthly',
            'completed',
          ),
          make(
            '2',
            '2026-08-01',
            '2026-08-15',
            '2026-08',
            0,
            'monthly',
            'missed',
          ),
        ],
        '2026-09-01',
      ),
    ).toBeUndefined());
});
