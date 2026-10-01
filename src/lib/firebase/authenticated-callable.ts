import {firebaseAuth} from './auth';
import {getFirebaseApp} from './app';
/** Explicit token transport also supports native sessions whose Functions SDK omits auth. */
export async function authenticatedCallable<T>(
  name: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const user = firebaseAuth().currentUser;
  const idToken = await user?.getIdToken(true);
  if (!idToken || !user || firebaseAuth().currentUser?.uid !== user.uid)
    throw new Error('Sign in is required.');
  const response = await fetch(
    `https://us-central1-${
      getFirebaseApp().options.projectId
    }.cloudfunctions.net/${name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({data: {...data, idToken}}),
    },
  );
  const payload = (await response.json()) as {
    result?: T;
    data?: T;
    error?: {message?: string};
  };
  if (firebaseAuth().currentUser?.uid !== user.uid)
    throw new Error('Your account changed. Please try again.');
  if (!response.ok || payload.error)
    throw new Error(
      payload.error?.message || 'This request is unavailable. Try again.',
    );
  return (payload.result ?? payload.data) as T;
}
