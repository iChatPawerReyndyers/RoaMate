import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '@/services/api/client';
import { useTrip, TripMember } from '@/app/TripContext';
import { useAccount } from '@/app/AccountContext';
import TripTabs from '@/app/navigation/TripTabs';
import { TripStackParamList } from '@/app/navigation/TripStack';
import AccountBadge from '@/features/account/AccountBadge';
import TripInfoModal from './TripInfoModal';

export default function TripHomeScreen() {
  const { currentTrip, setTripMembers } = useTrip();
  const { account } = useAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Home'>>();

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
    // Intentionally keyed on tripId, not the whole currentTrip object: this
    // effect calls setTripMembers, which produces a new currentTrip object
    // (new members array) every time it runs. Depending on currentTrip
    // itself would re-trigger this same effect on every successful fetch,
    // looping forever - "Loading members..." would never settle.
  }, [currentTrip?.tripId, setTripMembers]);

  if (!currentTrip) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.titleTouchable} onPress={() => setInfoModalVisible(true)}>
            <Text style={styles.title} numberOfLines={1}>{currentTrip.name ?? 'Your trip'}</Text>
          </TouchableOpacity>
          {account?.username ? <AccountBadge username={account.username} /> : null}
        </View>
        <Text style={styles.subtitle}>
          Invite code: {currentTrip.inviteCode} · {currentTrip.members.length} member
          {currentTrip.members.length === 1 ? '' : 's'}
        </Text>
        {loading ? <Text style={styles.loading}>Loading members…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.tabsWrapper}>
        <TripTabs tripId={currentTrip.tripId} onSafetyPress={() => navigation.navigate('Geo')} />
      </View>
      <TripInfoModal visible={infoModalVisible} trip={currentTrip} onClose={() => setInfoModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titleTouchable: { flexShrink: 1 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  loading: { color: '#444', fontSize: 12, marginTop: 4 },
  error: { color: '#b00020', fontSize: 12, marginTop: 4 },
  tabsWrapper: { flex: 1 },
});