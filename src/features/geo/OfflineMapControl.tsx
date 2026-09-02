import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  deleteOfflinePackForTrip,
  downloadOfflinePackForTrip,
  getOfflinePackForTrip,
  OFFLINE_MAP_CAP_BYTES,
  OfflineStorageFullError,
  totalOfflineBytes,
} from '@/services/maps/OfflineMapManager';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  tripId: string;
  /** Destinations + last-known member locations to bound the downloaded region. */
  coordinates: { lat: number; lng: number }[];
}

type Status = { kind: 'checking' } | { kind: 'none' } | { kind: 'downloading'; percentage: number } | { kind: 'downloaded'; bytes: number };

/**
 * Previously a full-width banner permanently showing the 500MB-cap usage
 * line even when idle - dominated the bottom of the map for something
 * that's rarely being interacted with. Redesigned to a small pill in the
 * map's bottom-left corner (see MapScreen.tsx, which nudges MapLibre's own
 * required attribution text to bottom-right to make room):
 *   - idle: a small round download icon, tap to start
 *   - downloading: a compact pill with a real mini progress bar
 *   - downloaded: a small "Map saved" pill
 * The "X.XMB / 500.0MB used across all trips" cap total isn't something
 * that needs to be visible at a glance - it now only shows up in the
 * Alert you get by tapping the idle or downloaded pill, alongside the
 * delete action (previously always visible as its own text link).
 */
export default function OfflineMapControl({ tripId, coordinates }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'checking' });
  const [totalBytes, setTotalBytes] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [pack, total] = await Promise.all([getOfflinePackForTrip(tripId), totalOfflineBytes()]);
      setTotalBytes(total);
      if (pack && pack.percentage >= 100) {
        setStatus({ kind: 'downloaded', bytes: pack.bytes });
      } else if (pack) {
        setStatus({ kind: 'downloading', percentage: pack.percentage });
      } else {
        setStatus({ kind: 'none' });
      }
    } catch (err) {
      console.warn('Failed to read offline map status', err);
      setStatus({ kind: 'none' });
    }
  }, [tripId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDownload = async () => {
    setStatus({ kind: 'downloading', percentage: 0 });
    try {
      await downloadOfflinePackForTrip(tripId, coordinates, ({ percentage }) => {
        setStatus({ kind: 'downloading', percentage });
      });
      await refresh();
    } catch (err) {
      if (err instanceof OfflineStorageFullError) {
        Alert.alert(
          'Offline storage full',
          "You've reached the 500MB offline map limit. Delete another trip's offline map first to free up space.",
        );
      } else {
        console.warn('Failed to download offline map', err);
        Alert.alert("Couldn't download offline map", 'Check your connection and try again.');
      }
      await refresh();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteOfflinePackForTrip(tripId);
      await refresh();
    } catch (err) {
      console.warn('Failed to delete offline map', err);
    }
  };

  const showCapDetails = (extraLine?: string) => {
    Alert.alert(
      'Offline maps',
      `${extraLine ? `${extraLine}\n\n` : ''}${formatBytes(totalBytes)} / ${formatBytes(OFFLINE_MAP_CAP_BYTES)} used across all trips.`,
    );
  };

  const handleIdlePress = () => {
    Alert.alert(
      'Download offline map',
      `Saves this trip's map area for offline use.\n\n${formatBytes(totalBytes)} / ${formatBytes(OFFLINE_MAP_CAP_BYTES)} used across all trips.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Download', onPress: handleDownload },
      ],
    );
  };

  const handleDownloadedPress = () => {
    Alert.alert(
      'Offline map saved',
      `This trip's map is available offline (${formatBytes(status.kind === 'downloaded' ? status.bytes : 0)}).\n\n${formatBytes(totalBytes)} / ${formatBytes(OFFLINE_MAP_CAP_BYTES)} used across all trips.`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  if (status.kind === 'checking') {
    return null;
  }

  if (status.kind === 'none') {
    return (
      <TouchableOpacity onPress={handleIdlePress} style={styles.position}>
        <NeumorphicView variant="raised" radius={17} style={styles.iconButton}>
          <Text style={styles.iconGlyph}>⬇</Text>
        </NeumorphicView>
      </TouchableOpacity>
    );
  }

  if (status.kind === 'downloading') {
    return (
      <NeumorphicView variant="raised" radius={15} style={[styles.position, styles.pill]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, status.percentage))}%` }]} />
        </View>
        <Text style={styles.pillText}>{Math.round(status.percentage)}%</Text>
      </NeumorphicView>
    );
  }

  return (
    <TouchableOpacity onPress={handleDownloadedPress} style={styles.position}>
      <NeumorphicView variant="raised" radius={15} style={styles.pill}>
        <Text style={styles.savedCheck}>✓</Text>
        <Text style={styles.pillText}>Map saved</Text>
      </NeumorphicView>
    </TouchableOpacity>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 15, color: neuColors.accent },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  progressTrack: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: neuColors.surfaceInset,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: neuColors.accent,
  },
  pillText: { fontSize: 11, fontWeight: '700', color: neuColors.textPrimary },
  savedCheck: { fontSize: 12, fontWeight: '700', color: neuColors.accent },
});