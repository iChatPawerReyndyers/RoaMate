import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapScreen from '@/features/geo/MapScreen';
import ActivityDashboardScreen from '@/features/activity/ActivityDashboardScreen';
import ItineraryContainer from './ItineraryContainer';
import NeuSegmentedControl from '@/components/neumorphic/NeuSegmentedControl';
import { neuColors, neuSpacing } from '@/theme/neumorphic';

interface Props {
  tripId: string;
}

type SubView = 'map' | 'itinerary' | 'activity';

const SUB_VIEWS: { key: SubView; label: string }[] = [
  { key: 'map', label: 'Map' },
  { key: 'itinerary', label: 'Itinerary' },
  { key: 'activity', label: 'Activity' },
];

/**
 * Rendered as a tab inside TripTabs, which itself sits inside
 * TripHomeScreen's SafeAreaView - deliberately a plain View here, not
 * another SafeAreaView. Stacking a second SafeAreaView on top of one
 * that's already accounting for the same top/bottom device insets just
 * adds that same inset's worth of dead space again, which is what was
 * producing the oversized gap above and below this segmented control.
 * Top/bottom safe areas for this whole tab tree are handled exactly once,
 * by TripHomeScreen (top) and TripTabs' own custom tab bar (bottom).
 */
export default function ItineraryHubScreen({ tripId }: Props) {
  const [activeView, setActiveView] = useState<SubView>('map');
  // Set when the Itinerary tab's "Edit" button is tapped on a destination -
  // editing now happens on the Map tab (a compact Name+Priority card
  // focused on that pin) instead of a separate full-screen form. See
  // MapScreen's own comment on editDestinationId for how it's consumed.
  const [focusDestinationId, setFocusDestinationId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.segmentWrap}>
        <NeuSegmentedControl options={SUB_VIEWS} value={activeView} onChange={setActiveView} />
      </View>
      <View style={styles.content}>
        {activeView === 'map' ? (
          <MapScreen tripId={tripId} editDestinationId={focusDestinationId} onEditHandled={() => setFocusDestinationId(null)} />
        ) : null}
        {activeView === 'itinerary' ? (
          <ItineraryContainer
            tripId={tripId}
            onRequestEditOnMap={destinationId => {
              setFocusDestinationId(destinationId);
              setActiveView('map');
            }}
          />
        ) : null}
        {activeView === 'activity' ? <ActivityDashboardScreen tripId={tripId} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  segmentWrap: { paddingHorizontal: neuSpacing.lg, paddingTop: neuSpacing.sm, paddingBottom: neuSpacing.xs },
  content: { flex: 1 },
});