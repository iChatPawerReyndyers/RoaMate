import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Android requires an explicit runtime permission request for location,
 * separate from the manifest entry - without this, Geolocation.getCurrentPosition
 * silently fails (invokes its error callback) even with the manifest
 * permission declared. iOS has no equivalent step here: the OS shows its
 * own prompt automatically the first time Geolocation is used, driven by
 * NSLocationWhenInUseUsageDescription in Info.plist.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: 'RoaMate uses your location to show it on the trip map and in emergency beacons.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Location permission request failed', err);
    return false;
  }
}