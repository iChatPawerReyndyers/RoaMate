import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import CreateTripScreen from '@/features/trip/CreateTripScreen';
import JoinTripScreen from '@/features/trip/JoinTripScreen';
import ScanQRScreen from '@/features/trip/ScanQRScreen';
import { useTrip } from '@/app/TripContext';

export type AuthStackParamList = {
  CreateTrip: undefined;
  JoinTrip: { inviteCode?: string; inviteSecret?: string } | undefined;
  ScanQR: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  const navigation = useNavigation();
  const { setCurrentTrip } = useTrip();

  return (
    <Stack.Navigator>
      <Stack.Screen name="CreateTrip" options={{ title: 'New Trip' }}>
        {props => (
          <CreateTripScreen
            {...props}
            onCreated={trip => {
              setCurrentTrip({ tripId: trip.id, inviteCode: trip.inviteCode, name: trip.name, defaultCurrency: trip.defaultCurrency });
              navigation.navigate('Trip' as never);
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="JoinTrip" options={{ title: 'Join Trip' }}>
        {props => (
          <JoinTripScreen
            {...props}
            onJoined={trip => {
              setCurrentTrip({ tripId: trip.id, inviteCode: trip.inviteCode, name: trip.name, defaultCurrency: trip.defaultCurrency });
              navigation.navigate('Trip' as never);
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ScanQR" options={{ title: 'Scan QR' }}>
        {props => <ScanQRScreen {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}