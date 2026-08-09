/**
 * GEO-02/03: handles incoming SILENT push messages to trigger an on-demand
 * location fix (see MapScreen.tsx / SilentPushService.java on the backend
 * for the full flow this is one half of).
 *
 * DISABLED for now. This requires a real Firebase project - a
 * google-services.json / GoogleService-Info.plist from your own Firebase
 * console, which doesn't exist yet for this app. Without them,
 * @react-native-firebase/app fails to register as a native module and
 * crashes the app at startup (New Architecture eagerly registers every
 * linked TurboModule, whether or not anything calls it). Pulled the
 * package out entirely rather than leave a half-configured native
 * dependency blocking every build.
 *
 * The backend side of this was already a stub too - see
 * SilentPushService.dispatchSilentPush() in the backend, which has never
 * actually sent a push. Restoring this requires both halves:
 *   1. Create a real Firebase project, add google-services.json /
 *      GoogleService-Info.plist, re-add @react-native-firebase/app and
 *      @react-native-firebase/messaging (npm install), re-add the
 *      android/app/build.gradle google-services plugin + root classpath.
 *   2. Implement dispatchSilentPush() on the backend for real (FCM HTTP
 *      v1 API via firebase-admin, or APNs directly).
 */
export function registerPushHandlers(_tripId: string, _userId: string): () => void {
  console.warn('registerPushHandlers: push notifications are disabled (no Firebase project configured yet)');
  return () => {};
}
