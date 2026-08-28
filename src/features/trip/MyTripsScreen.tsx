import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { apiClient, NetworkUnavailableError } from '@/services/api/client';
import { useTrip } from '@/app/TripContext';
import { useAccount } from '@/app/AccountContext';
import { cacheTripsFromServer, getCachedTrips, CachedTrip, TripDto } from '@/db/repositories/tripsRepository';
import AccountBadge from '@/features/account/AccountBadge';

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
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('Auth' as never)}>
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      {isOffline ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>You’re offline - showing your saved trips.</Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      {loading && trips.length === 0 ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={item => item.serverId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openTrip(item)}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>
                Code {item.inviteCode} · {item.memberCount} member{item.memberCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Create or join a trip to see it here.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2f6fed', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
  banner: { backgroundColor: '#fff4e5', borderRadius: 8, padding: 10, marginBottom: 12 },
  bannerText: { color: '#8a5a00', fontSize: 13 },
  loading: { marginTop: 40 },
  list: { paddingBottom: 24 },
  card: { backgroundColor: '#f5f8ff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#d7e3ff' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#555', fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 40, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', borderRadius: 12, padding: 20 },
  emptyText: { color: '#888', fontSize: 13 },
});