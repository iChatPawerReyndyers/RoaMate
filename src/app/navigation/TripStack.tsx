import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { neuColors } from '@/theme/neumorphic';

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

interface EditDestinationRouteProps {
  tripId: string;
  destinationId?: string;
  navigation: NativeStackNavigationProp<TripStackParamList, 'DestinationForm'>;
}

/**
 * Pulled out to a real named component instead of an inline arrow function
 * passed as <Stack.Screen>'s children (which is how this used to be
 * written). That pattern is a documented, supported way to pass route
 * params through to a screen - but a component defined inline, INSIDE
 * another component's render, is a fresh function value every single time
 * the parent (TripStack) re-renders, e.g. whenever `currentTrip`'s
 * reference changes (TripHomeScreen's member-loading effect does this
 * once per trip open). There's no correctness guarantee that hooks inside
 * such a function keep their state across that kind of parent re-render,
 * only that *this specific case* happened to work in testing - which is
 * exactly the kind of bug that's easy to introduce and hard to reproduce
 * on demand. Naming and hoisting it here removes that risk entirely,
 * regardless of whether it was the actual cause of the edit screen
 * sometimes rendering blank.
 *
 * Also replaces the old `if (loading) return null` with a real spinner:
 * a silently blank screen with no spinner, no error, nothing - which is
 * indistinguishable from "broken" - is worse than a spinner that spins
 * for a moment. If the fetch ever fails, or the destination genuinely
 * can't be found (e.g. it was deleted from another device in the
 * meantime), that's now a real, visible error state with a way back,
 * instead of an unexplained empty page.
 */
function EditDestinationRoute({ tripId, destinationId, navigation }: EditDestinationRouteProps) {
  const [initialValues, setInitialValues] = useState<Partial<DestinationFormValues> | undefined>(undefined);
  const [loading, setLoading] = useState(!!destinationId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!destinationId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    apiClient
      .get<RemoteDestination[]>(`/api/v1/itinerary/trips/${tripId}/destinations`)
      .then(all => {
        if (cancelled) return;
        const existing = all.find(d => d.id === destinationId);
        if (!existing) {
          setLoadError("This destination couldn't be found - it may have been removed.");
          return;
        }
        setInitialValues({
          name: existing.name,
          address: existing.address ?? '',
          operatingHours: existing.operatingHours ?? '',
          targetBudgetDollars: existing.targetBudgetCents != null ? String(existing.targetBudgetCents / 100) : '',
          attachmentUrls: existing.attachmentUrls ? existing.attachmentUrls.split(',') : [],
          priority: existing.priority ?? 'REQUIRED',
        });
      })
      .catch(err => {
        console.warn('Failed to load destination for editing', err);
        if (!cancelled) setLoadError('Unable to load this destination right now. Check your connection and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [destinationId, tripId]);

  if (loading) {
    return (
      <SafeAreaView style={routeStyles.centered}>
        <ActivityIndicator size="large" color={neuColors.accent} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={routeStyles.centered}>
        <Text style={routeStyles.errorText}>{loadError}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={routeStyles.backButton}>
          <Text style={routeStyles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <DestinationFormScreen
      initialValues={initialValues}
      onSubmit={async values => {
        try {
          await apiClient.post('/api/v1/itinerary/destinations', {
            ...(destinationId ? { id: destinationId } : {}),
            tripId,
            ...values,
          });
          navigation.goBack();
        } catch (err) {
          console.warn('Failed to save destination', err);
          Alert.alert("Couldn't save", 'Check your connection and try again.');
        }
      }}
    />
  );
}

const routeStyles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, color: neuColors.danger, textAlign: 'center', marginBottom: 16 },
  backButton: { paddingVertical: 10, paddingHorizontal: 20 },
  backButtonText: { fontSize: 14, fontWeight: '700', color: neuColors.accent },
});

const activityRouteStyles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: neuColors.background },
});

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
        {({ navigation, route }) => (
          <EditDestinationRoute tripId={currentTrip.tripId} destinationId={route.params.destinationId} navigation={navigation} />
        )}
      </Stack.Screen>
      <Stack.Screen name="KittyDeposit" options={{ title: 'Trip Kitty' }}>
        {() => <KittyDepositScreen tripId={currentTrip.tripId} tripMembers={currentTrip.members} currency={currentTrip.defaultCurrency} />}
      </Stack.Screen>
      <Stack.Screen name="Activity" options={{ title: 'Activity' }}>
        {({ route }) => (
          // edges=['bottom'] only: this route already has a native-stack
          // header (title: 'Activity'), which already reserves the top
          // safe-area inset - a full-default SafeAreaView here would
          // double that space up, same bug as the tab-embedded screens.
          // The bottom edge genuinely does need covering here though,
          // since (unlike the tab-embedded case) this screen's content can
          // reach all the way to the physical bottom edge of the device.
          <SafeAreaView style={activityRouteStyles.fill} edges={['bottom']}>
            <ActivityDashboardScreen
              tripId={currentTrip.tripId}
              destinationId={route.params?.destinationId}
              destinationName={route.params?.destinationName}
            />
          </SafeAreaView>
        )}
      </Stack.Screen>
      <Stack.Screen name="Geo" options={{ title: 'Trip Safety' }}>
        {() => <GeoScreen tripId={currentTrip.tripId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}