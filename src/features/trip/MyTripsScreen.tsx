import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { apiClient, NetworkUnavailableError } from '@/services/api/client';
import { useTrip } from '@/app/TripContext';
import { useAccount } from '@/app/AccountContext';
import { cacheTripsFromServer, getCachedTrips, CachedTrip, TripDto } from '@/db/repositories/tripsRepository';
import AccountBadge from '@/features/account/AccountBadge';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { NeuEmptyState } from '@/components/neumorphic/NueModal';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

/**
 * TRIP-01: landing screen on every app open. Always tries the server first
 * (trips can change from other devices/members), and falls back to the
 * local WatermelonDB cache - written on the last successful fetch - if the
 * device has no connectivity, so "my trips" is still usable offline.
 */
export default function MyTripsScreen() {
  const database = useDatabase();
  const navigation = useNavigation();
  const { setCurrentTrip } = useTrip();
  const { account } = useAccount();

  const [trips, setTrips] = useState<CachedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const serverTrips = await apiClient.get<TripDto[]>('/api/v1/trips');
      await cacheTripsFromServer(database, serverTrips);
      setTrips(
        serverTrips.map(trip => ({
          serverId: trip.id,
          name: trip.name,
          description: trip.description,
          inviteCode: trip.inviteCode,
          memberCount: trip.members.length,
          defaultCurrency: trip.defaultCurrency,
        })),
      );
      setIsOffline(false);
    } catch (err) {
      const cached = await getCachedTrips(database);
      setTrips(cached);

      if (err instanceof NetworkUnavailableError) {
        setIsOffline(true);
      } else {
        console.warn('Failed to refresh trips, showing cached copy', err);
        setError('Couldn’t refresh trips - showing your last saved list.');
      }
    } finally {
      setLoading(false);
    }
  }, [database]);

  // Refresh every time this screen comes back into focus (e.g. after
  // creating or joining a trip, or returning from a trip's dashboard).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openTrip = async (trip: CachedTrip) => {
    setCurrentTrip({ tripId: trip.serverId, inviteCode: trip.inviteCode, name: trip.name, description: trip.description, defaultCurrency: trip.defaultCurrency });
    navigation.navigate('Trip' as never);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My trips</Text>
        <View style={styles.headerRight}>
          {account?.username ? <AccountBadge username={account.username} /> : null}
          <TouchableOpacity onPress={() => navigation.navigate('Auth' as never)}>
            <NeumorphicView variant="raised" size="sm" radius={17} backgroundColor={neuColors.accent} style={styles.addButton}>
              <Text style={styles.addButtonText}>+</Text>
            </NeumorphicView>
          </TouchableOpacity>
        </View>
      </View>
      {isOffline ? (
        <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.banner}>
          <Text style={styles.bannerText}>You’re offline - showing your saved trips.</Text>
        </NeumorphicView>
      ) : null}
      {error ? (
        <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </NeumorphicView>
      ) : null}

      {loading && trips.length === 0 ? (
        <ActivityIndicator style={styles.loading} color={neuColors.accent} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item.serverId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openTrip(item)} activeOpacity={0.85}>
              <NeuCard size="md" style={styles.tripCard}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSubtitle}>
                  Code {item.inviteCode} · {item.memberCount} member{item.memberCount === 1 ? '' : 's'}
                </Text>
              </NeuCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <NeuEmptyState
              icon="🧭"
              title="No trips yet"
              description="Create or join a trip to see it here."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background, padding: neuSpacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: neuColors.textPrimary },
  addButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: neuColors.white, fontSize: 20, fontWeight: '700', marginTop: -2 },
  banner: { padding: 10, marginBottom: 12 },
  bannerText: { color: neuColors.textPrimary, fontSize: 13 },
  loading: { marginTop: 40 },
  list: { paddingBottom: 24, paddingTop: 8 },
  tripCard: { padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4, color: neuColors.textPrimary },
  cardSubtitle: { color: neuColors.textMuted, fontSize: 13 },
});