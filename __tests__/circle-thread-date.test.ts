import {buildCircleThreadDaySections} from '../src/features/circles/services/circle-thread-date';
import type {CircleThreadItem} from '../src/types/models';

function item(id: string, createdAt: string): CircleThreadItem {
  return {
    actor: {initials: 'KM', name: 'Kelvin', uid: 'user-1'},
    createdAtLabel: '12:00 PM',
    createdAtMs: new Date(createdAt).getTime(),
    id,
    isLikedByViewer: false,
    kind: 'message',
    likeCount: 0,
    text: id,
  };
}

describe('circle thread day sections', () => {
  it('labels calendar days in the profile timezone', () => {
    const sections = buildCircleThreadDaySections({
      items: [
        item('older', '2026-07-26T12:00:00.000Z'),
        item('yesterday', '2026-07-28T03:59:00.000Z'),
        item('today', '2026-07-28T04:01:00.000Z'),
      ],
      now: new Date('2026-07-28T12:00:00.000Z'),
      timezone: 'America/New_York',
    });

    expect(sections.map(section => [section.dateKey, section.label])).toEqual([
      ['2026-07-26', 'JUL 26, 2026'],
      ['2026-07-27', 'YESTERDAY'],
      ['2026-07-28', 'TODAY'],
    ]);
  });

  it('keeps items from the same calendar day in one section', () => {
    const sections = buildCircleThreadDaySections({
      items: [
        item('morning', '2026-07-28T00:01:00.000Z'),
        item('evening', '2026-07-28T23:59:00.000Z'),
      ],
      now: new Date('2026-07-28T12:00:00.000Z'),
      timezone: 'UTC',
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      dateKey: '2026-07-28',
      label: 'TODAY',
    });
    expect(sections[0].items.map(sectionItem => sectionItem.id)).toEqual([
      'morning',
      'evening',
    ]);
  });
});
