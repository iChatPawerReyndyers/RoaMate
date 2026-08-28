import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapScreen from '@/features/geo/MapScreen';
import ActivityDashboardScreen from '@/features/activity/ActivityDashboardScreen';
import ItineraryContainer from './ItineraryContainer';

interface Props {
  tripId: string;
}

type SubView = 'map' | 'itinerary' | 'activity';

const SUB_VIEWS: { key: SubView; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'activity', label: 'Activity' },
];

export default function ItineraryHubScreen({ tripId }: Props) {
  const [activeView, setActiveView] = useState<SubView>('map');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.segmentRow}>
        {SUB_VIEWS.map(view => {
          const isActive = activeView === view.key;
          return (
            <TouchableOpacity
              key={view.key}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => setActiveView(view.key)}
            >
              <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>{view.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.content}>
        {activeView === 'map' ? <MapScreen tripId={tripId} /> : null}
        {activeView === 'itinerary' ? <ItineraryContainer tripId={tripId} /> : null}
        {activeView === 'activity' ? <ActivityDashboardScreen tripId={tripId} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  segmentRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e3ff',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  segmentLabel: { fontSize: 13, fontWeight: '600', color: '#1d4ed8' },
  segmentLabelActive: { color: '#fff' },
  content: { flex: 1, marginTop: 8 },
});