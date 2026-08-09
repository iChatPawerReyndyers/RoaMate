import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapScreen from '@/features/geo/MapScreen';
import ExpenseEntryScreen from '@/features/finance/ExpenseEntryScreen';
import FinanceSummaryScreen from '@/features/finance/FinanceSummaryScreen';
import ConflictReviewDashboard from '@/features/finance/ConflictReviewDashboard';
import ChecklistContainer from '@/features/checklists/ChecklistContainer';
import ActivityDashboardScreen from '@/features/activity/ActivityDashboardScreen';
import TripHomeScreen from '@/features/trip/TripHomeScreen';
import ItineraryContainer from '@/features/itinerary/ItineraryContainer';
import DestinationNotesScreen from '@/features/itinerary/DestinationNotesScreen';
import GeoScreen from '@/features/geo/GeoScreen';
import { useTrip } from '@/app/TripContext';
import { apiClient } from '@/services/api/client';
import { getDeviceId } from '@/services/security/KeyManager';

export type TripStackParamList = {
  Home: undefined;
  Map: undefined;
  AddExpense: { itemId?: string; description?: string } | undefined;
  ReviewDuplicates: undefined;
  Checklist: undefined;
  Itinerary: undefined;
  Geo: undefined;
  FinanceSummary: undefined;
  Activity: undefined;
  DestinationNotes: { destinationId: string; destinationName: string };
};

const Stack = createNativeStackNavigator<TripStackParamList>();

export default function TripStack() {
  const { currentTrip } = useTrip();

  if (!currentTrip) {
    return null;
  }

  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" options={{ title: 'My Trip' }} component={TripHomeScreen} />
      <Stack.Screen name="Map" options={{ title: 'Trip Map' }}>
        {() => <MapScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="AddExpense" options={{ title: 'New Expense' }}>
        {({ navigation, route }) => (
          <ExpenseEntryScreen
            tripMembers={currentTrip.members}
            initialDescription={route.params?.description}
            onSubmit={async payload => {
              try {
                if (route.params?.itemId) {
                  await apiClient.post(`/api/v1/checklists/items/${route.params.itemId}/convert-to-expense`, {
                    ...payload,
                    tripId: currentTrip.tripId,
                    createdByUserId: await getDeviceId(),
                    expenseDate: new Date().toISOString(),
                    category: null,
                  });
                } else {
                  await apiClient.post('/api/v1/finance/expenses', {
                    ...payload,
                    tripId: currentTrip.tripId,
                    createdByUserId: await getDeviceId(),
                    expenseDate: new Date().toISOString(),
                    category: null,
                  });
                }
                navigation.navigate('Home');
              } catch (err) {
                console.warn('Failed to submit expense', err);
              }
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ReviewDuplicates" options={{ title: 'Review Flagged Expenses' }}>
        {() => <ConflictReviewDashboard tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="Checklist" options={{ title: 'Checklist' }}>
        {() => <ChecklistContainer tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="Itinerary" options={{ title: 'Itinerary' }}>
        {() => <ItineraryContainer tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="DestinationNotes" options={{ title: 'Destination Notes' }}>
        {({ route }) => (
          <DestinationNotesScreen
            destinationId={route.params.destinationId}
            destinationName={route.params.destinationName}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="FinanceSummary" options={{ title: 'Settlement Summary' }}>
        {() => <FinanceSummaryScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="Activity" options={{ title: 'Activity' }}>
        {() => <ActivityDashboardScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="Geo" options={{ title: 'Trip Safety' }}>
        {() => <GeoScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
