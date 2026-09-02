import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  username: string;
}

/** Shown in the header of both MyTripsScreen and TripHomeScreen, so who's logged in stays visible throughout the app. */
export default function AccountBadge({ username }: Props) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.container}>
      <NeumorphicView variant="raised" size="sm" radius={12} backgroundColor={neuColors.accent} style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </NeumorphicView>
      <Text style={styles.username} numberOfLines={1}>{username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 140 },
  avatar: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: neuColors.white, fontSize: 12, fontWeight: '700' },
  username: { fontSize: 13, fontWeight: '600', color: neuColors.textPrimary, flexShrink: 1 },
});