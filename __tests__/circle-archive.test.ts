import {neutralizeCircleSlotAggregateForArchive} from '../functions/src/momentum/archive';
import {mapArchivedCircle} from '../src/features/circles/services/archived-circle-service';
import {mapHomeCircleFromData} from '../src/features/home/services/home-data-service';

jest.mock('../src/lib/firebase/firestore', () => ({
  firebaseFirestore: jest.fn(),
}));

describe('Circle archive behavior', () => {
  it('neutralizes only unfinished expectations in current and future slots', () => {
    expect(
      neutralizeCircleSlotAggregateForArchive(
        {
          completedMemberUids: ['done-1'],
          coveredMemberUids: ['done-1', 'skip-1'],
          expectedMemberUids: ['done-1', 'skip-1', 'pending-1'],
          expiresDateKey: '2026-08-04',
          skippedMemberUids: ['skip-1'],
        },
        '2026-08-04',
      ),
    ).toEqual({
      completedMemberCount: 1,
      completedMemberUids: ['done-1'],
      coveredMemberCount: 2,
      coveredMemberUids: ['done-1', 'skip-1'],
      expectedMemberCount: 2,
      expectedMemberUids: ['done-1', 'skip-1'],
      skippedMemberCount: 1,
      skippedMemberUids: ['skip-1'],
    });
  });

  it('preserves closed historical expectations', () => {
    expect(
      neutralizeCircleSlotAggregateForArchive(
        {
          coveredMemberUids: ['done-1'],
          expectedMemberUids: ['done-1', 'missed-1'],
          expiresDateKey: '2026-08-03',
        },
        '2026-08-04',
      ).expectedMemberUids,
    ).toEqual(['done-1', 'missed-1']);
  });

  it('maps archived current memberships into the Settings library', () => {
    expect(
      mapArchivedCircle({
        circleData: {
          category: 'Fitness',
          circleMode: 'group',
          commitment: 'Move for 30 minutes',
          lifecycleStatus: 'archived',
          memberCount: 4,
          title: 'Morning Movers',
        },
        circleId: 'circle-1',
        membershipData: {role: 'member', status: 'active'},
      }),
    ).toMatchObject({
      id: 'circle-1',
      lifecycleStatus: 'archived',
      viewerRole: 'member',
    });
  });

  it('excludes archived Circles from active Home data but maps read-only detail', () => {
    const input = {
      circleData: {
        category: 'Fitness',
        circleMode: 'group',
        commitment: 'Move for 30 minutes',
        lifecycleStatus: 'archived',
        memberCount: 1,
        title: 'Morning Movers',
      },
      circleId: 'circle-1',
      membershipData: {
        role: 'owner',
        status: 'active',
        uid: 'user-1',
      },
    };

    expect(mapHomeCircleFromData(input)).toBeUndefined();
    expect(
      mapHomeCircleFromData({...input, includeArchived: true}),
    ).toMatchObject({
      id: 'circle-1',
      lifecycleStatus: 'archived',
      viewerRole: 'owner',
    });
  });
});
