import React, { useMemo, useRef, useState } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import PinnedLocationCard from './PinnedLocationCard';

export interface Destination {
  id: string;
  name: string;
  notes?: string;
  assignedDay?: string;
  lat?: number;
  lng?: number;
  attachmentUrls?: string;
}

interface Props {
  destinations: Destination[];
  isAdmin: boolean;
  onReorder: (orderedIds: string[]) => void;
  onOpenNotes: (destinationId: string, destinationName: string) => void;
  onStartActivity: (destinationId: string, destinationName: string) => void;
  onAddDestination: () => void;
  onEditDestination: (destinationId: string) => void;
}

const ROW_HEIGHT = 210; // approximate rendered height of one PinnedLocationCard row, used to convert drag distance into index deltas

/**
 * ITIN-01: per-day itinerary list with drag-to-reorder (react-native-gesture-handler).
 * TRIP-02: "Admin can edit core itineraries" - adding, reordering and editing
 * destinations is gated on isAdmin; everything else in the app (expenses,
 * notes, activities, checklists, conflict review, privacy toggles) is
 * intentionally left open to all participants per spec, so this is the only
 * screen in the app with a role gate.
 */
export default function ItineraryScreen({
  destinations,
  isAdmin,
  onReorder,
  onOpenNotes,
  onStartActivity,
  onAddDestination,
  onEditDestination,
}: Props) {
  const byDay = useMemo(() => groupByDay(destinations), [destinations]);

  const handleDayReorder = (day: string, dayLocalOrderedIds: string[]) => {
    // Splice this day's new local order back into the full destinations
    // list, leaving every other day's stops and ordering untouched.
    const otherDays = destinations.filter(d => (d.assignedDay ?? 'Unscheduled') !== day);
    const thisDayReordered = dayLocalOrderedIds
      .map(id => destinations.find(d => d.id === id))
      .filter((d): d is Destination => d !== undefined);

    // Preserve overall day-group ordering: rebuild by walking the original
    // day sequence and substituting the reordered day's stops in place.
    const dayOrderSequence = Array.from(new Set(destinations.map(d => d.assignedDay ?? 'Unscheduled')));
    const merged: Destination[] = [];
    for (const d of dayOrderSequence) {
      if (d === day) {
        merged.push(...thisDayReordered);
      } else {
        merged.push(...otherDays.filter(od => (od.assignedDay ?? 'Unscheduled') === d));
      }
    }
    onReorder(merged.map(d => d.id));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {isAdmin ? (
          <TouchableOpacity style={styles.addButton} onPress={onAddDestination}>
            <Text style={styles.addButtonText}>+ Add destination</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.readOnlyHint}>Only trip admins can add or reorder destinations.</Text>
        )}

        {Object.entries(byDay).map(([day, stops]) => (
          <DaySection
            key={day}
            day={day}
            stops={stops}
            isAdmin={isAdmin}
            onReorder={orderedIds => handleDayReorder(day, orderedIds)}
            onOpenNotes={onOpenNotes}
            onStartActivity={onStartActivity}
            onEditDestination={onEditDestination}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function DaySection({
  day,
  stops,
  isAdmin,
  onReorder,
  onOpenNotes,
  onStartActivity,
  onEditDestination,
}: {
  day: string;
  stops: Destination[];
  isAdmin: boolean;
  onReorder: (orderedIds: string[]) => void;
  onOpenNotes: (destinationId: string, destinationName: string) => void;
  onStartActivity: (destinationId: string, destinationName: string) => void;
  onEditDestination: (destinationId: string) => void;
}) {
  const [order, setOrder] = useState(stops.map(s => s.id));
  const stopsById = useMemo(() => new Map(stops.map(s => [s.id, s])), [stops]);

  const handleDrop = (id: string, moveBy: number) => {
    const fromIndex = order.indexOf(id);
    if (fromIndex === -1 || moveBy === 0) return;

    const toIndex = Math.max(0, Math.min(order.length - 1, fromIndex + moveBy));
    if (toIndex === fromIndex) return;

    const next = [...order];
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, id);
    setOrder(next);
    onReorder(next);
  };

  return (
    <View style={styles.daySection}>
      <Text style={styles.dayHeader}>{day}</Text>
      {order.map((id, index) => {
        const stop = stopsById.get(id);
        if (!stop) return null;
        const row = (
          <View style={styles.itemRow}>
            <PinnedLocationCard
              destinationId={stop.id}
              name={stop.name}
              dayLabel={day}
              lat={stop.lat}
              lng={stop.lng}
              attachmentUrls={stop.attachmentUrls}
              onAddNote={() => onOpenNotes(stop.id, stop.name)}
              onStartActivity={() => onStartActivity(stop.id, stop.name)}
            />
            {isAdmin && (
              <TouchableOpacity style={styles.editButton} onPress={() => onEditDestination(stop.id)}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        );

        // Participants get a plain, non-draggable row - drag-to-reorder is
        // an itinerary edit, which is admin-only.
        if (!isAdmin) {
          return (
            <View key={id} style={styles.readOnlyRow}>
              {row}
            </View>
          );
        }

        return (
          <DraggableRow key={id} index={index} lastIndex={order.length - 1} onDrop={moveBy => handleDrop(id, moveBy)}>
            {row}
          </DraggableRow>
        );
      })}
    </View>
  );
}

/**
 * Wraps one row in a vertical pan gesture. Drags the row visually while the
 * finger moves, then on release converts the drag distance into a whole
 * number of row-positions to move by and reports that to the parent, which
 * owns the actual reordering. Snaps back to position 0 either way - the
 * parent re-renders rows in their new order rather than this component
 * tracking a persistent offset.
 */
function DraggableRow({
  children,
  index,
  lastIndex,
  onDrop,
}: {
  children: React.ReactNode;
  index: number;
  lastIndex: number;
  onDrop: (moveBy: number) => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);

  const onGestureEvent = Animated.event([{ nativeEvent: { translationY: translateY } }], { useNativeDriver: true });

  const onHandlerStateChange = (event: PanGestureHandlerStateChangeEvent) => {
    const { state, translationY } = event.nativeEvent;
    if (state === State.END) {
      const moveBy = Math.round(translationY / ROW_HEIGHT);
      const clamped = Math.max(-index, Math.min(lastIndex - index, moveBy));
      setDragging(false);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      if (clamped !== 0) onDrop(clamped);
    } else if (state === State.ACTIVE) {
      setDragging(true);
    }
  };

  return (
    <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View
        style={[
          styles.draggableWrapper,
          dragging && styles.draggableActive,
          { transform: [{ translateY }] },
        ]}
      >
        <View style={styles.dragHandle}>
          <Text style={styles.dragHandleText}>⠿</Text>
        </View>
        <View style={styles.draggableContent}>{children}</View>
      </Animated.View>
    </PanGestureHandler>
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
  scroll: { paddingBottom: 24 },
  addButton: { margin: 16, backgroundColor: '#2f6fed', borderRadius: 10, padding: 12, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
  readOnlyHint: { marginHorizontal: 16, marginTop: 16, marginBottom: 4, fontSize: 12, color: '#888', fontStyle: 'italic' },
  readOnlyRow: { marginBottom: 12, marginLeft: 28 },
  daySection: { paddingHorizontal: 16, paddingTop: 8 },
  dayHeader: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  draggableWrapper: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12, zIndex: 1 },
  draggableActive: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  dragHandle: { width: 28, alignItems: 'center', justifyContent: 'center' },
  dragHandleText: { fontSize: 18, color: '#aaa' },
  draggableContent: { flex: 1 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  editButton: { backgroundColor: '#dfe7ff', borderRadius: 10, padding: 10, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  editButtonText: { color: '#2f6fed', fontWeight: '700', fontSize: 12 },
});
