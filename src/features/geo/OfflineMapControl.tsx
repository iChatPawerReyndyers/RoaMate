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

interface Props {
  tripId: string;
  /** Destinations + last-known member locations to bound the downloaded region. */
  coordinates: { lat: number; lng: number }[];
}

type Status = { kind: 'checking' } | { kind: 'none' } | { kind: 'downloading'; percentage: number } | { kind: 'downloaded'; bytes: number };

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

  if (status.kind === 'checking') {
    return null;
  }

  return (
    <View style={styles.container}>
      {status.kind === 'none' && (
        <TouchableOpacity style={styles.button} onPress={handleDownload}>
          <Text style={styles.buttonText}>Download offline map</Text>
        </TouchableOpacity>
      )}
      {status.kind === 'downloading' && (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#2f6fed" />
          <Text style={styles.label}>Downloading… {Math.round(status.percentage)}%</Text>
        </View>
      )}
      {status.kind === 'downloaded' && (
        <View style={styles.row}>
          <Text style={styles.label}>Offline map saved ({formatBytes(status.bytes)})</Text>
          <TouchableOpacity onPress={handleDelete}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.capLabel}>
        {formatBytes(totalBytes)} / {formatBytes(OFFLINE_MAP_CAP_BYTES)} used across all trips
      </Text>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  button: { backgroundColor: '#2f6fed', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  label: { fontSize: 12, color: '#333', flex: 1 },
  deleteText: { fontSize: 12, color: '#b00020', fontWeight: '700' },
  capLabel: { fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' },
});
