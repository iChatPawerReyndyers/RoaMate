import { Platform } from 'react-native';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/services/security/KeyManager';
import { resolveMockResponse } from '@/services/api/mockData';

/**
 * Testing aid ONLY, for clicking through the whole app on a phone with no
 * backend running - flip to false to go back to always hitting the real
 * API.
 */
export const USE_MOCK_DATA_WHEN_OFFLINE = false;

/**
 * __DEV__ alone doesn't cover every "this is still just me testing"
 * scenario: `./gradlew assembleRelease` (or an Xcode Release scheme)
 * produces a release build - which sets __DEV__ to false - even when it's
 * just going onto your own phone for testing, not to a real user via the
 * Play Store/TestFlight/anything you'd hand someone else.
 *
 * This flag is what actually extends mock mode to that case, kept
 * deliberately separate from __DEV__ itself so the two can be reasoned
 * about independently: __DEV__ reflects the build type (debug vs
 * release), this reflects intent (is this build going anywhere but my own
 * test device).
 *
 * MUST be false before building a release that goes to anyone but you -
 * true here means mock data AND the test-mode login bypass
 * (AccountAuthScreen.tsx) both stay active even in a release build.
 */
export const ALLOW_TEST_MODE_IN_RELEASE_BUILDS = true;

/** What every mock-mode check in the app should actually gate on - see the two flags above for what each half means. */
export const TEST_MODE = (__DEV__ || ALLOW_TEST_MODE_IN_RELEASE_BUILDS) && USE_MOCK_DATA_WHEN_OFFLINE;

/**
 * When there's no backend running at all (the common case while just
 * clicking through UI), every single request still has to actually try
 * the real API first and wait out FETCH_TIMEOUT_MS (5s) before falling
 * back to mock data - see the catch block in request() below. That 5s-per-
 * request wait, on every screen, makes the app feel frozen/broken rather
 * than "working offline", especially since several screens fire off more
 * than one request on mount.
 *
 * Turning this on skips the real network attempt entirely when TEST_MODE
 * is active: matched endpoints resolve from mockData.ts immediately, and
 * anything without a mock route fails immediately too (as a
 * NetworkUnavailableError, same as it would after the 5s timeout) instead
 * of hanging first. Leave this false to still exercise the real
 * fetch-then-fallback path (e.g. testing what happens when a real backend
 * drops mid-session).
 */
export const FORCE_MOCK_ONLY = true;

/**
 * Android emulators run in their own virtual network - `localhost` from
 * inside the emulator refers to the emulator itself, not your host
 * machine. `10.0.2.2` is the special alias Android's emulator provides
 * specifically to reach the host's localhost. iOS Simulator shares the
 * host's network stack directly, so plain `localhost` works there.
 * Physical devices need your machine's real LAN IP instead of either -
 * not handled here, since it varies per network.
 */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

/** The backend deployed on Render (Singapore), running against the Neon database. Swap for a custom domain later if you add one. */
const DEPLOYED_BACKEND_URL = 'https://roamate-backend-exfs.onrender.com';

/**
 * true  = debug builds talk to the deployed backend too. This is what you
 *         want on a physical phone, where `localhost` / `10.0.2.2` can't
 *         reach a backend running on your computer anyway.
 * false = debug builds use a backend you run yourself on port 8080
 *         (`./mvnw spring-boot:run`). Release builds ALWAYS use the
 *         deployed backend, whatever this says.
 */
const USE_DEPLOYED_BACKEND_IN_DEV = true;

const BASE_URL = USE_DEPLOYED_BACKEND_IN_DEV || !__DEV__ ? DEPLOYED_BACKEND_URL : `http://${DEV_HOST}:8080`;

/**
 * Thrown when the request never reached the server at all (device is
 * offline, DNS/connection refused, etc.) - distinct from a non-2xx HTTP
 * response, which means the server *was* reached. Screens that have a local
 * cache (e.g. MyTripsScreen) catch this specifically to decide whether to
 * show an "offline, showing saved data" state.
 */
export class NetworkUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(cause: unknown) {
    super('Network request failed - device appears to be offline');
    this.name = 'NetworkUnavailableError';
    this.cause = cause;
  }
}

/**
 * Thrown for any non-2xx response the server actually sent back (as
 * opposed to NetworkUnavailableError, which means the request never got
 * there). Carries the HTTP status so callers - e.g. AccountContext telling
 * a 409 "username taken" apart from a 401 "wrong password" - don't have to
 * parse it back out of a message string.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * AccountContext registers itself here on mount. When a request comes back
 * 401 outside of /api/v1/auth/**, it means the cached token is no longer
 * valid (expired, or the server rotated its signing secret) and - unlike
 * the old dev-login bootstrap - there's no way to silently mint a fresh
 * one without real credentials. The cleanest recovery is to drop the local
 * session and send the person back to the sign-in screen.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

// Testing without a deployed backend (physical device, no local server
// reachable) means every request is guaranteed to fail - the question is
// only how fast. iOS's "localhost" refuses instantly on a real device
// (nothing's listening on the phone itself), but Android physical devices
// have no equivalent to the emulator-only 10.0.2.2 alias, so that request
// can sit unresolved for a long default OS timeout before rejecting.
// Aborting after 5s keeps the mock-data fallback (see USE_MOCK_DATA_
// WHEN_OFFLINE above) feeling instant on either platform instead of the
// app appearing to hang.
//
// Mock mode keeps the short 5s timeout for exactly that reason. Against the
// real deployed backend it has to be much longer: Render's free tier spins
// the service down when idle, and the first request after that has to wait
// for the whole Spring Boot app to start again. Measured in Render's logs:
// "Started RoaMateApplication in 155.1 seconds" - so anything under ~3
// minutes turns a normal wake-up into a false "you're offline". 4 minutes
// leaves headroom. (A paid Render instance, or pinging the backend every
// ~10 minutes so it never sleeps, makes this wait a non-issue.)
const FETCH_TIMEOUT_MS = TEST_MODE ? 5000 : 240000;

/**
 * Wakes the deployed backend up. Render's free tier spins the service down
 * after ~15 minutes idle, and the first request afterwards has to wait for
 * the whole Spring Boot app to boot. Calling this the moment the app opens
 * (and again when it returns to the foreground) means that boot happens
 * while the person is still looking at the splash / sign-in screen instead
 * of during their first real request.
 *
 * Fire-and-forget on purpose: the response is ignored and every failure is
 * swallowed, since this is only a nudge. /api/v1/auth/hello is public (no
 * token needed) and returns a tiny plain string, so it works before login.
 * Skipped entirely in mock-only mode, where nothing ever reaches a server.
 */
export function warmUpBackend(): void {
  if (TEST_MODE && FORCE_MOCK_ONLY) {
    return;
  }
  fetch(`${BASE_URL}/api/v1/auth/hello`).catch(() => undefined);
}

async function doFetch(path: string, method: string, token: string | null, body?: unknown, extraHeaders?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // fetch() itself throwing (not a non-2xx response) means the request
    // never reached the server - no connectivity, no backend running, or
    // (via the abort above) it just took too long to say either way. All
    // of these mean the same thing to callers: treat it as unreachable.
    //
    // The screens only show a generic "can't reach the server", so log the
    // real reason here where Metro / adb logcat / Xcode can see it:
    // "AbortError" = it hit FETCH_TIMEOUT_MS, "TypeError: Network request
    // failed" = DNS / TLS / no connection / connection reset by the server.
    console.warn(`[api] ${method} ${BASE_URL}${path} did not reach the server:`, err);
    throw new NetworkUnavailableError(err);
  } finally {
    clearTimeout(timeout);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isAuthPath = path.startsWith('/api/v1/auth');

  if (TEST_MODE && FORCE_MOCK_ONLY) {
    const mocked = resolveMockResponse(method, path, body);
    if (mocked) {
      console.warn(`[mock] FORCE_MOCK_ONLY active, returning mock data for ${method} ${path}`);
      return mocked.data as T;
    }
    // No mock route defined for this endpoint yet - fail the same way the
    // real timeout path would (NetworkUnavailableError), just without
    // actually waiting FETCH_TIMEOUT_MS first.
    throw new NetworkUnavailableError(new Error(`No mock route defined for ${method} ${path}`));
  }

  const token = isAuthPath ? null : await getAuthToken();

  let response;
  try {
    response = await doFetch(path, method, token, body);
  } catch (err) {
    if (err instanceof NetworkUnavailableError && TEST_MODE) {
      const mocked = resolveMockResponse(method, path, body);
      if (mocked) {
        console.warn(`[mock] backend unreachable, returning mock data for ${method} ${path}`);
        return mocked.data as T;
      }
    }
    throw err;
  }

  if (response.status === 401 && !isAuthPath) {
    await clearAuthToken();
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || `API ${method} ${path} failed: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  /** ACT-05: added for "Finish activity at this stop" (PATCH .../activity-complete) - every other verb here already had a caller, this one didn't yet. */
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  download: async (path: string): Promise<ArrayBuffer> => {
    const token = await getAuthToken();
    const response = await doFetch(path, 'GET', token, undefined, { Accept: 'application/octet-stream' });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(response.status, text || `API GET ${path} failed: ${response.status}`);
    }

    return response.arrayBuffer();
  },
};