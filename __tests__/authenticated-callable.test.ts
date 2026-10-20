const mockGetIdToken = jest.fn();
let mockCurrentUser:
  | {uid: string; getIdToken: typeof mockGetIdToken}
  | undefined;
jest.mock('../src/lib/firebase/auth', () => ({
  firebaseAuth: () => ({currentUser: mockCurrentUser}),
}));
jest.mock('../src/lib/firebase/app', () => ({
  getFirebaseApp: () => ({options: {projectId: 'test-hoyst'}}),
}));
import {authenticatedCallable} from '../src/lib/firebase/authenticated-callable';

describe('authenticatedCallable token transport', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    mockGetIdToken.mockReset().mockResolvedValue('test-token');
    mockCurrentUser = {uid: 'user-1', getIdToken: mockGetIdToken};
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({result: {saved: true}}),
    });
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses a cached valid token for Tap In and preserves explicit token transport', async () => {
    await expect(
      authenticatedCallable('submitTapIn', {circleId: 'circle-1'}),
    ).resolves.toEqual({saved: true});
    expect(mockGetIdToken).toHaveBeenCalledWith(false);
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(request.body).data).toEqual({
      circleId: 'circle-1',
      idToken: 'test-token',
    });
  });

  it('retains the current refresh behavior for other callables', async () => {
    await authenticatedCallable('ensureProgress');
    expect(mockGetIdToken).toHaveBeenCalledWith(true);
  });

  it('does not send a request after the account changes during token acquisition', async () => {
    mockGetIdToken.mockImplementation(async () => {
      mockCurrentUser = undefined;
      return 'test-token';
    });
    await expect(authenticatedCallable('submitTapIn')).rejects.toThrow(
      'Sign in is required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an old response after the account changes', async () => {
    fetchMock.mockImplementation(async () => {
      mockCurrentUser = {uid: 'user-2', getIdToken: mockGetIdToken};
      return {ok: true, json: async () => ({result: {saved: true}})};
    });
    await expect(authenticatedCallable('submitTapIn')).rejects.toThrow(
      'Your account changed',
    );
  });
});
