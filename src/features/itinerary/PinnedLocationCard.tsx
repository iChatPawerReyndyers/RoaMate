import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  name: string;
  notes?: string;
}

/** ITIN-02: a single pinned destination card. */
export default function PinnedLocationCard({ name, notes }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      {notes ? <Text style={styles.notes}>{notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f7f8fb', borderRadius: 10, padding: 12, marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '600' },
  notes: { fontSize: 12, color: '#777', marginTop: 4 },
});
