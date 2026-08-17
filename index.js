/**
 * @format
 */
import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './src/app/App';
import { name as appName } from './app.json';
import { handleBackgroundLocationRequest } from './src/services/push/PushService';

// GEO-02/03: must be registered here, at the true top level, before
// AppRegistry.registerComponent runs and outside any React component -
// this is what lets a silent push wake the app (or run a JS callback while
// it's backgrounded/killed) to grab a GPS fix and respond, per Firebase's
// own requirement for background message handling.
setBackgroundMessageHandler(getMessaging(getApp()), handleBackgroundLocationRequest);

AppRegistry.registerComponent(appName, () => App);