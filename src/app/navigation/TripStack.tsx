import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ExpenseEntryScreen from '@/features/finance/ExpenseEntryScreen';
import ActivityDashboardScreen from '@/features/activity/ActivityDashboardScreen';
import TripHomeScreen from '@/features/trip/TripHomeScreen';
import DestinationNotesScreen from '@/features/itinerary/DestinationNotesScreen';
import DestinationFormScreen, { DestinationFormValues } from '@/features/itinerary/DestinationFormScreen';
import PaymentSourceScreen from '@/features/checklists/PaymentSourceScreen';
import KittyDepositScreen from '@/features/finance/KittyDepositScreen';
import GeoScreen from '@/features/geo/GeoScreen';
import { useTrip } from '@/app/TripContext';
import { useSync } from '@/sync/SyncContext';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';
import { useAutoOfflineMapSync } from '@/services/maps/AutoOfflineMapSync';

// NOTE: Map, Checklist, ReviewDuplicates and FinanceSummary used to be
// top-level routes here, reachable only from the old TripHomeScreen card
// menu. They now live inside the Itinerary/Expenses/Checklist tabs
// (see TripTabs.tsx), so they've been removed from this stack. Activity,
// AddExpense, DestinationNotes, DestinationForm, SelectPaymentSource and Geo
// stay registered here because they're still reached as deep-link-style
// pushes (a specific destination's activity log, a checklist item being
// converted to an expense, a pinned location's notes, adding/editing a
// destination, and the Safety Hub icon).
export type TripStackParamList = {
  Home: undefined;
  AddExpense:
    | {
        itemId?: string;
        description?: string;
        initialPaymentSource?: { source: 'KITTY' } | { source: 'MEMBER_ABONO'; payerUserId: string };
      }
    | undefined;
  SelectPaymentSource: { itemId: string; description: string };
  Activity: { destinationId?: string; destinationName?: string } | undefined;
  DestinationNotes: { destinationId: string; destinationName: string };
  DestinationForm: { tripId: string; destinationId?: string };
  KittyDeposit: undefined;
  Geo: undefined;
};

interface RemoteDestination {
  id: string;
  name: string;
  address?: string;
  operatingHours?: string;
  targetBudgetCents?: number;
  attachmentUrls?: string;
  priority?: 'REQUIRED' | 'OPTIONAL' | 'TENTATIVE';
}

const Stack = createNativeStackNavigator<TripStackParamList>();

export default function TripStack() {
  const { currentTrip } = useTrip();
  const syncManager = useSync();
  useAutoOfflineMapSync(currentTrip?.tripId ?? null);

  if (!currentTrip) {
    return null;
  }

  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" options={{ headerShown: false }} component={TripHomeScreen} />
      <Stack.Screen name="AddExpense" options={{ title: 'New Expense' }}>
        {({ navigation, route }) => (
          <ExpenseEntryScreen
            tripMembers={currentTrip.members}
            initialDescription={route.params?.description}
            initialPaymentSource={route.params?.initialPaymentSource}
            onSubmit={async payload => {
              if (route.params?.itemId) {
                // Checklist-to-expense conversion isn't covered by offline
                // sync yet (see backend ExpenseCreatedApplier's doc
                // comment - it's a two-step operation the applier doesn't
                // handle) - surface the failure rather than queueing
                // something the server can't apply on reconnect.
                try {
                  await apiClient.post(`/api/v1/checklists/items/${route.params.itemId}/convert-to-expense`, {
                    ...payload,
                    tripId: currentTrip.tripId,
                    createdByUserId: await getCurrentUserId(),
                    expenseDate: new Date().toISOString(),
                    category: null,
                  });
                  navigation.navigate('Home');
                } catch (err) {
                  console.warn('Failed to convert checklist item to expense', err);
                  Alert.alert("Couldn't save expense", 'Check your connection and try again.');
                }
                return;
              }

              const expensePayload = {
                ...payload,
                tripId: currentTrip.tripId,
                createdByUserId: await getCurrentUserId(),
                expenseDate: new Date().toISOString(),
                category: null,
              };
              try {
                await apiClient.post('/api/v1/finance/expenses', expensePayload);
              } catch (err) {
                // FIN-01/03: offline-first means a failed post here queues
                // for later sync instead of the expense silently vanishing
                // (previously: caught, logged, and dropped) - mirrors the
                // same pattern ItineraryContainer uses for reorders. The
                // backend already applies this exact event type
                // (ExpenseCreatedApplier), it just wasn't being sent.
                console.warn('Failed to submit expense, queued for sync', err);
                await syncManager.enqueueEvent({
                  tripId: currentTrip.tripId,
                  eventType: 'EXPENSE_CREATED',
                  clientTimestamp: Date.now(),
                  payloadJson: JSON.stringify(expensePayload),
                });
              }
              navigation.navigate('Home');
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SelectPaymentSource" options={{ title: 'Who paid?' }}>
        {({ navigation, route }) => (
          <PaymentSourceScreen
            itemLabel={route.params.description}
            tripMembers={currentTrip.members}
            onContinue={choice => {
              navigation.navigate('AddExpense', {
                itemId: route.params.itemId,
                description: route.params.description,
                initialPaymentSource:
                  choice.type === 'KITTY' ? { source: 'KITTY' } : { source: 'MEMBER_ABONO', payerUserId: choice.userId },
              });
            }}
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
      <Stack.Screen name="DestinationForm" options={{ title: 'Destination' }}>
        {({ navigation, route }) => {
          const { destinationId } = route.params;
          const [initialValues, setInitialValues] = useState<Partial<DestinationFormValues> | undefined>(undefined);
          const [loading, setLoading] = useState(!!destinationId);

          useEffect(() => {
            if (!destinationId) return;
            let cancelled = false;
            apiClient
              .get<RemoteDestination[]>(`/api/v1/itinerary/trips/${currentTrip.tripId}/destinations`)
              .then(all => {
                if (cancelled) return;
                const existing = all.find(d => d.id === destinationId);
                if (existing) {
                  setInitialValues({
                    name: existing.name,
                    address: existing.address ?? '',
                    operatingHours: existing.operatingHours ?? '',
                    targetBudgetDollars:
                      existing.targetBudgetCents != null ? String(existing.targetBudgetCents / 100) : '',
                    attachmentUrls: existing.attachmentUrls ? existing.attachmentUrls.split(',') : [],
                    priority: existing.priority ?? 'REQUIRED',
                  });
                }
              })
              .catch(err => console.warn('Failed to load destination for editing', err))
              .finally(() => {
                if (!cancelled) setLoading(false);
              });
            return () => {
              cancelled = true;
            };
          }, [destinationId]);

          if (loading) {
            return null;
          }

          return (
            <DestinationFormScreen
              initialValues={initialValues}
              onSubmit={async values => {
                try {
                  await apiClient.post('/api/v1/itinerary/destinations', {
                    ...(destinationId ? { id: destinationId } : {}),
                    tripId: currentTrip.tripId,
                    ...values,
                  });
                  navigation.goBack();
                } catch (err) {
                  console.warn('Failed to save destination', err);
                }
              }}
            />
          );
        }}
      </Stack.Screen>
      <Stack.Screen name="KittyDeposit" options={{ title: 'Trip Kitty' }}>
        {() => <KittyDepositScreen tripId={currentTrip.tripId} tripMembers={currentTrip.members} currency={currentTrip.defaultCurrency} />}
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