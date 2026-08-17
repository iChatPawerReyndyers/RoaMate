import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import TripStack from './TripStack';
import MyTripsScreen from '@/features/trip/MyTripsScreen';
import AccountAuthScreen from '@/features/account/AccountAuthScreen';
import { useAccount } from '@/app/AccountContext';

export type RootStackParamList = {
  MyTrips: undefined;
  Auth: undefined;
  Trip: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { account, isLoading } = useAccount();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {account ? (
        <Stack.Navigator initialRouteName="MyTrips" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MyTrips" component={MyTripsScreen} />
          <Stack.Screen name="Auth" component={AuthStack} />
          <Stack.Screen name="Trip" component={TripStack} />
        </Stack.Navigator>
      ) : (
        // No route registered for the trip screens while logged out - there's
        // no way to navigate around this screen, only through it.
        <AccountAuthScreen />
      )}
    </NavigationContainer>
  );
}