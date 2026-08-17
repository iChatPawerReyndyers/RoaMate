import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  username: string;
}

/** Shown in the header of both MyTripsScreen and TripHomeScreen, so who's logged in stays visible throughout the app. */
export default function AccountBadge({ username }: Props) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <Text style={styles.username} numberOfLines={1}>{username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2f6fed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  username: { fontSize: 13, fontWeight: '600', color: '#333', flexShrink: 1 },
});