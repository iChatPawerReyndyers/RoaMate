import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import TripStack from './TripStack';
import MyTripsScreen from '@/features/trip/MyTripsScreen';

export type RootStackParamList = {
  MyTrips: undefined;
  Auth: undefined;
  Trip: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="MyTrips" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MyTrips" component={MyTripsScreen} />
        <Stack.Screen name="Auth" component={AuthStack} />
        <Stack.Screen name="Trip" component={TripStack} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}