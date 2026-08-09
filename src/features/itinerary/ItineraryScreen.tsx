import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PinnedLocationCard from './PinnedLocationCard';

export interface Destination {
  id: string;
  name: string;
  notes?: string;
  assignedDay?: string;
}

interface Props {
  destinations: Destination[];
  onReorder: (orderedIds: string[]) => void;
  onOpenNotes: (destinationId: string, destinationName: string) => void;
}

/** ITIN-01: per-day itinerary list. Drag-reorder wiring point noted below. */
export default function ItineraryScreen({ destinations, onReorder, onOpenNotes }: Props) {
  const byDay = groupByDay(destinations);
  const indexMap = React.useMemo(
    () => destinations.reduce<Record<string, number>>((acc, destination, idx) => {
      acc[destination.id] = idx;
      return acc;
    }, {}),
    [destinations],
  );

  const handleMove = (id: string, direction: 'up' | 'down') => {
    const index = indexMap[id];
    if (index === undefined) return;

    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= destinations.length) return;

    const reordered = [...destinations];
    const current = reordered[index]!;
    const target = reordered[nextIndex]!;
    reordered[index] = target;
    reordered[nextIndex] = current;
    onReorder(reordered.map(d => d.id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={Object.entries(byDay)}
        keyExtractor={([day]) => day}
        renderItem={({ item: [day, stops] }) => (
          <View style={styles.daySection}>
            <Text style={styles.dayHeader}>{day}</Text>
            {stops.map(stop => {
              const globalIndex = indexMap[stop.id];
              return (
                <View key={stop.id} style={styles.itemRow}>
                  <PinnedLocationCard name={stop.name} notes={stop.notes} />
                  <View style={styles.buttons}>
                    <TouchableOpacity
                      style={[styles.reorderButton, globalIndex === 0 && styles.disabledButton]}
                      disabled={globalIndex === 0}
                      onPress={() => handleMove(stop.id, 'up')}
                    >
                      <Text style={styles.buttonText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.reorderButton, globalIndex === destinations.length - 1 && styles.disabledButton]}
                      disabled={globalIndex === destinations.length - 1}
                      onPress={() => handleMove(stop.id, 'down')}
                    >
                      <Text style={styles.buttonText}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.noteButton} onPress={() => onOpenNotes(stop.id, stop.name)}>
                      <Text style={styles.noteButtonText}>Notes</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function groupByDay(destinations: Destination[]): Record<string, Destination[]> {
  return destinations.reduce((acc, d) => {
    const day = d.assignedDay ?? 'Unscheduled';
    (acc[day] ??= []).push(d);
    return acc;
  }, {} as Record<string, Destination[]>);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  daySection: { paddingHorizontal: 16, paddingTop: 16 },
  dayHeader: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  buttons: { flexDirection: 'row', alignItems: 'center' },
  reorderButton: { backgroundColor: '#eef2ff', borderRadius: 10, padding: 10, minWidth: 40, alignItems: 'center', marginRight: 8 },
  noteButton: { backgroundColor: '#dfe7ff', borderRadius: 10, padding: 10, minWidth: 64, alignItems: 'center' },
  noteButtonText: { color: '#2f6fed', fontWeight: '700' },
  disabledButton: { opacity: 0.4 },
  buttonText: { color: '#2f6fed', fontWeight: '700' },
});
