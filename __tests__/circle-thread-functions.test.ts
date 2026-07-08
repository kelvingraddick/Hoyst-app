const mockSnapshots = new Map<string, Record<string, unknown> | undefined>();
const mockTransactionSet = jest.fn();
const mockTransactionGet = jest.fn();
const mockRunTransaction = jest.fn(async callback => {
  const transaction = {
    get: mockTransactionGet,
    set: mockTransactionSet,
  };

  return callback(transaction);
});

type Ref = {
  collection: (name: string) => Ref;
  doc: (id: string) => Ref;
  get: () => Promise<ReturnType<typeof mockSnapshot>>;
  id: string;
  path: string;
};

function mockSnapshot(data?: Record<string, unknown>) {
  return {
    data: () => data,
    exists: Boolean(data),
  };
}

function mockCreateRef(path: string): Ref {
  return {
    collection: (name: string) => mockCreateRef(`${path}/${name}`),
    doc: (id: string) => mockCreateRef(`${path}/${id}`),
    get: async () => mockSnapshot(mockSnapshots.get(path)),
    id: path.split('/').at(-1) ?? path,
    path,
  };
}

jest.mock('../functions/src/firebase', () => ({
  db: {
    collection: jest.fn((name: string) => mockCreateRef(name)),
    runTransaction: (callback: unknown) => mockRunTransaction(callback),
  },
}));

jest.mock(
  'firebase-admin/app',
  () => ({
    getApps: () => [{}],
    initializeApp: jest.fn(),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-admin/auth',
  () => ({
    getAuth: () => ({
      verifyIdToken: jest.fn(),
    }),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-admin/firestore',
  () => ({
    FieldValue: {
      delete: jest.fn(() => ({type: 'delete'})),
      increment: jest.fn((value: number) => ({type: 'increment', value})),
      serverTimestamp: jest.fn(() => ({type: 'serverTimestamp'})),
    },
    getFirestore: () => ({
      collection: jest.fn((name: string) => mockCreateRef(name)),
      runTransaction: (callback: unknown) => mockRunTransaction(callback),
    }),
  }),
  {virtual: true},
);

jest.mock(
  'firebase-functions/v2/https',
  () => {
    class MockHttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    }

    return {
      HttpsError: MockHttpsError,
      onCall: (handler: unknown) => handler,
    };
  },
  {virtual: true},
);

import {
  getCircleThreadNudgeText,
  getCircleThreadStreakText,
  sanitizeCircleThreadText,
  sendCircleThreadMessage,
} from '../functions/src/thread';

const invokeSendCircleThreadMessage =
  sendCircleThreadMessage as unknown as (request: {
    auth?: {uid: string};
    data: Record<string, unknown>;
  }) => Promise<{itemId: string}>;

describe('circle thread functions', () => {
  beforeEach(() => {
    mockSnapshots.clear();
    jest.clearAllMocks();
    mockTransactionGet.mockImplementation(async (ref: Ref) =>
      mockSnapshot(mockSnapshots.get(ref.path)),
    );
    mockSnapshots.set('users/user-1', {
      avatarUrl: 'https://example.com/kelvin.jpg',
      displayName: 'Kelvin',
      handle: 'kelvin',
      onboardingStatus: 'complete',
    });
    mockSnapshots.set('circles/circle-1', {
      title: 'Sleep 8 Hours',
    });
    mockSnapshots.set('circles/circle-1/members/user-1', {
      status: 'active',
    });
  });

  it('sanitizes copy and builds activity text', () => {
    expect(sanitizeCircleThreadText('  hello circle  ')).toBe('hello circle');
    expect(
      getCircleThreadNudgeText({
        actorName: 'Sam',
        targetCount: 1,
        targetName: 'Priya',
      }),
    ).toBe('Sam nudged Priya');
    expect(getCircleThreadStreakText(6)).toBe('Circle hit a 6-day streak!');
  });

  it('writes a server-owned message for active members', async () => {
    await expect(
      invokeSendCircleThreadMessage({
        auth: {uid: 'user-1'},
        data: {
          circleId: 'circle-1',
          messageId: 'message-1',
          text: '  Nice work  ',
        },
      }),
    ).resolves.toEqual({itemId: 'message-1'});

    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.objectContaining({path: 'circles/circle-1/feedItems/message-1'}),
      expect.objectContaining({
        actor: expect.objectContaining({
          displayName: 'Kelvin',
          uid: 'user-1',
        }),
        kind: 'message',
        text: 'Nice work',
      }),
    );
    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.objectContaining({path: 'circles/circle-1/threadReads/user-1'}),
      expect.objectContaining({readAt: {type: 'serverTimestamp'}}),
      {merge: true},
    );
  });

  it('rejects messages from non-active members', async () => {
    mockSnapshots.set('circles/circle-1/members/user-1', {
      status: 'pending',
    });

    await expect(
      invokeSendCircleThreadMessage({
        auth: {uid: 'user-1'},
        data: {
          circleId: 'circle-1',
          messageId: 'message-1',
          text: 'Nice work',
        },
      }),
    ).rejects.toMatchObject({
      code: 'permission-denied',
      message: 'Join this circle first.',
    });
  });
});
