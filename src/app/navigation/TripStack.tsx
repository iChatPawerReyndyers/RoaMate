import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MapScreen from '@/features/geo/MapScreen';
import ExpenseEntryScreen from '@/features/finance/ExpenseEntryScreen';
import FinanceSummaryScreen from '@/features/finance/FinanceSummaryScreen';
import KittyDepositScreen from '@/features/finance/KittyDepositScreen';
import ConflictReviewDashboard from '@/features/finance/ConflictReviewDashboard';
import ChecklistContainer from '@/features/checklists/ChecklistContainer';
import PaymentSourceScreen, { PaymentSourceChoice } from '@/features/checklists/PaymentSourceScreen';
import ActivityDashboardScreen from '@/features/activity/ActivityDashboardScreen';
import TripHomeScreen from '@/features/trip/TripHomeScreen';
import ItineraryContainer from '@/features/itinerary/ItineraryContainer';
import DestinationNotesScreen from '@/features/itinerary/DestinationNotesScreen';
import DestinationFormScreen from '@/features/itinerary/DestinationFormScreen';
import GeoScreen from '@/features/geo/GeoScreen';
import { useTrip } from '@/app/TripContext';
import { apiClient } from '@/services/api/client';
import { getDeviceId } from '@/services/security/KeyManager';
import { Cents } from '@/money/Cents';

export type TripStackParamList = {
  Home: undefined;
  Map: undefined;
  AddExpense: { itemId?: string; description?: string; paymentSource?: PaymentSourceChoice } | undefined;
  ReviewDuplicates: undefined;
  Checklist: undefined;
  SelectPaymentSource: { itemId: string; description: string };
  Itinerary: undefined;
  DestinationForm: { tripId: string; destinationId?: string };
  Geo: undefined;
  FinanceSummary: undefined;
  KittyDeposit: undefined;
  Activity: { destinationId?: string; destinationName?: string } | undefined;
  DestinationNotes: { destinationId: string; destinationName: string };
};

interface BackendDestination {
  id: string;
  name: string;
  address?: string;
  operatingHours?: string;
  targetBudgetCents?: number;
  attachmentUrls?: string;
  assignedDay?: string;
  sortOrder?: number;
}

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
            initialPaymentSource={
              route.params?.paymentSource?.type === 'MEMBER'
                ? { source: 'MEMBER_ABONO', payerUserId: route.params.paymentSource.userId }
                : route.params?.paymentSource?.type === 'KITTY'
                  ? { source: 'KITTY' }
                  : undefined
            }
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
      <Stack.Screen name="SelectPaymentSource" options={{ title: 'Who Paid?' }}>
        {({ navigation, route }) => (
          <PaymentSourceScreen
            itemLabel={route.params.description}
            tripMembers={currentTrip.members}
            onContinue={choice => {
              navigation.navigate('AddExpense', {
                itemId: route.params.itemId,
                description: route.params.description,
                paymentSource: choice,
              });
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Itinerary" options={{ title: 'Itinerary' }}>
        {() => <ItineraryContainer tripId={currentTrip.tripId} />}
      </Stack.Screen>
      <Stack.Screen name="DestinationForm" options={{ title: 'Destination' }}>
        {({ navigation, route }) => (
          <DestinationFormLoader
            tripId={route.params.tripId}
            destinationId={route.params.destinationId}
            onDone={() => navigation.navigate('Itinerary')}
          />
        )}
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
      <Stack.Screen name="KittyDeposit" options={{ title: 'Trip Kitty' }}>
        {() => <KittyDepositScreen tripId={currentTrip.tripId} tripMembers={currentTrip.members} />}
      </Stack.Screen>
      <Stack.Screen name="Activity" options={{ title: 'Activity' }}>
        {({ route }) => (
          <ActivityDashboardScreen
            tripId={currentTrip.tripId}
            destinationId={route.params?.destinationId}
            destinationName={route.params?.destinationName}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Geo" options={{ title: 'Trip Safety' }}>
        {() => <GeoScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

/**
 * ITIN-02: loads the existing destination (edit mode) before rendering the
 * form, or renders it blank for a brand-new stop. Kept local to the stack
 * rather than its own file since it's a thin fetch-then-render wrapper.
 */
function DestinationFormLoader({
  tripId,
  destinationId,
  onDone,
}: {
  tripId: string;
  destinationId?: string;
  onDone: () => void;
}) {
  const [existing, setExisting] = useState<BackendDestination | null>(null);
  const [loading, setLoading] = useState(!!destinationId);

  useEffect(() => {
    if (!destinationId) return;
    apiClient
      .get<BackendDestination[]>(`/api/v1/itinerary/trips/${tripId}/destinations`)
      .then(all => setExisting(all.find(d => d.id === destinationId) ?? null))
      .catch(err => console.warn('Failed to load destination for editing', err))
      .finally(() => setLoading(false));
  }, [tripId, destinationId]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <DestinationFormScreen
      initialValues={
        existing
          ? {
              name: existing.name,
              address: existing.address ?? '',
              operatingHours: existing.operatingHours ?? '',
              targetBudgetDollars:
                existing.targetBudgetCents != null
                  ? Cents.toDollars(Cents.of(existing.targetBudgetCents)).toFixed(2)
                  : '',
              attachmentUrls: existing.attachmentUrls ? existing.attachmentUrls.split(',').map(s => s.trim()) : [],
            }
          : undefined
      }
      onSubmit={async values => {
        try {
          await apiClient.post('/api/v1/itinerary/destinations', {
            id: destinationId,
            tripId,
            ...values,
          });
          onDone();
        } catch (err) {
          console.warn('Failed to save destination', err);
        }
      }}
    />
  );
}
