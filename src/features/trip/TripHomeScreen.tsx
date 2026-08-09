import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@/services/api/client';
import { useTrip, TripMember } from '@/app/TripContext';

export default function TripHomeScreen() {
  const { currentTrip, setTripMembers } = useTrip();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    async function loadMembers() {
      if (!currentTrip) return;
      setLoading(true);
      setError(null);
      try {
        const members = await apiClient.get<TripMember[]>(`/api/v1/trips/${currentTrip.tripId}/members`);
        setTripMembers(members);
      } catch (err: any) {
        console.warn('Failed to load trip members', err);
        setError('Unable to load trip members right now.');
      } finally {
        setLoading(false);
      }
    }

    loadMembers();
  }, [currentTrip, setTripMembers]);

  if (!currentTrip) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Welcome to {currentTrip.name ?? 'Your Trip'}</Text>
        <Text style={styles.subtitle}>Invite code: {currentTrip.inviteCode}</Text>
        <Text style={styles.section}>Members: {currentTrip.members.length}</Text>
        {loading ? <Text style={styles.loading}>Loading members…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Map' as never)}>
            <Text style={styles.cardTitle}>Trip Map</Text>
            <Text style={styles.cardSubtitle}>See everyone’s shared location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Geo' as never)}>
            <Text style={styles.cardTitle}>Safety Hub</Text>
            <Text style={styles.cardSubtitle}>Share location and raise beacons</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AddExpense' as never)}>
            <Text style={styles.cardTitle}>Add Expense</Text>
            <Text style={styles.cardSubtitle}>Create a shared expense</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ReviewDuplicates' as never)}>
            <Text style={styles.cardTitle}>Review Duplicates</Text>
            <Text style={styles.cardSubtitle}>Resolve flagged expense matches</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Checklist' as never)}>
            <Text style={styles.cardTitle}>Packing List</Text>
            <Text style={styles.cardSubtitle}>View and check off items</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Itinerary' as never)}>
            <Text style={styles.cardTitle}>Itinerary</Text>
            <Text style={styles.cardSubtitle}>View and reorder trip stops</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('FinanceSummary' as never)}>
            <Text style={styles.cardTitle}>Settlement</Text>
            <Text style={styles.cardSubtitle}>View balances & export reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Activity' as never)}>
            <Text style={styles.cardTitle}>Activity</Text>
            <Text style={styles.cardSubtitle}>Log steps and elevation sessions</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  section: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  loading: { color: '#444', marginBottom: 8 },
  error: { color: '#b00020', marginBottom: 12 },
  grid: { gap: 12 },
  card: { backgroundColor: '#f5f8ff', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#d7e3ff' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardSubtitle: { color: '#555', fontSize: 13 },
});
