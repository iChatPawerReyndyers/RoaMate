import React, { useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  PanGestureHandlerStateChangeEvent,
  State,
} from 'react-native-gesture-handler';
import PinnedLocationCard from './PinnedLocationCard';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors } from '@/theme/neumorphic';

export type DestinationPriority = 'REQUIRED' | 'OPTIONAL' | 'TENTATIVE';

export interface Destination {
  id: string;
  name: string;
  notes?: string;
  assignedDay?: string;
  lat?: number;
  lng?: number;
  attachmentUrls?: string;
  priority?: DestinationPriority;
  /** ACT-05: null/undefined until "Finish activity at this stop" is tapped - see PinnedLocationCard's doc comment on hasFinishedActivity. */
  activityCompletedAt?: string;
}

interface Props {
  destinations: Destination[];
  onReorder: (orderedIds: string[]) => void;
  onOpenNotes: (destinationId: string, destinationName: string) => void;
  onStartActivity: (destinationId: string, destinationName: string) => void;
  onAddDestination: () => void;
  onEditDestination: (destinationId: string) => void;
  onRemoveDestination: (destinationId: string, destinationName: string) => void;
  /** ITIN-05: opens the Map tab with directions from the viewer's current location to this destination. */
  onGetDirections: (destinationId: string) => void;
}

const ROW_HEIGHT = 210; // approximate rendered height of one PinnedLocationCard row, used to convert drag distance into index deltas

/**
 * ITIN-01: per-day itinerary list with drag-to-reorder (react-native-gesture-handler).
 * Adding, editing, reordering, and removing destinations is open to any
 * trip member - trip membership itself is the gate (see requireMember in
 * ItineraryController.java), not a separate admin role, since you can't
 * reach this screen at all without already being a member of the trip.
 */
export default function ItineraryScreen({
  destinations,
  onReorder,
  onOpenNotes,
  onStartActivity,
  onAddDestination,
  onEditDestination,
  onRemoveDestination,
  onGetDirections,
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
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {Object.entries(byDay).map(([day, stops]) => (
          <DaySection
            key={day}
            day={day}
            stops={stops}
            onReorder={orderedIds => handleDayReorder(day, orderedIds)}
            onOpenNotes={onOpenNotes}
            onStartActivity={onStartActivity}
            onEditDestination={onEditDestination}
            onRemoveDestination={onRemoveDestination}
            onGetDirections={onGetDirections}
          />
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.fabTouchable} onPress={onAddDestination} activeOpacity={0.85}>
        <NeumorphicView variant="raised" size="fab" radius={28} backgroundColor={neuColors.accent} style={styles.fab}>
          <Text style={styles.fabIcon}>+</Text>
        </NeumorphicView>
      </TouchableOpacity>
    </View>
  );
}

function DaySection({
  day,
  stops,
  onReorder,
  onOpenNotes,
  onStartActivity,
  onEditDestination,
  onRemoveDestination,
  onGetDirections,
}: {
  day: string;
  stops: Destination[];
  onReorder: (orderedIds: string[]) => void;
  onOpenNotes: (destinationId: string, destinationName: string) => void;
  onStartActivity: (destinationId: string, destinationName: string) => void;
  onEditDestination: (destinationId: string) => void;
  onRemoveDestination: (destinationId: string, destinationName: string) => void;
  onGetDirections: (destinationId: string) => void;
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
          <PinnedLocationCard
            destinationId={stop.id}
            name={stop.name}
            lat={stop.lat}
            lng={stop.lng}
            attachmentUrls={stop.attachmentUrls}
            priority={stop.priority}
            activityCompletedAt={stop.activityCompletedAt}
            onAddNote={() => onOpenNotes(stop.id, stop.name)}
            onStartActivity={() => onStartActivity(stop.id, stop.name)}
            onEdit={() => onEditDestination(stop.id)}
            onRemove={() => onRemoveDestination(stop.id, stop.name)}
            onGetDirections={() => onGetDirections(stop.id)}
          />
        );

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
  container: { flex: 1, backgroundColor: neuColors.background },
  scroll: { paddingBottom: 96 },
  daySection: { paddingHorizontal: 16, paddingTop: 8 },
  dayHeader: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: neuColors.textPrimary },
  draggableWrapper: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 12, zIndex: 1 },
  draggableActive: { zIndex: 10, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  draggableContent: { flex: 1 },
  fabTouchable: { position: 'absolute', right: 20, bottom: 24 },
  fab: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  fabIcon: { color: neuColors.white, fontSize: 28, fontWeight: '300', marginTop: -2 },
});