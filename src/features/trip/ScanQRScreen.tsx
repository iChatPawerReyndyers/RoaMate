import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/app/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'ScanQR'>;

/**
 * TRIP-01: scans a trip's invite QR and hands the decoded invite code to
 * JoinTripScreen for confirmation, rather than joining directly - lets the
 * person correct a misread or a QR meant for a different trip.
 *
 * InviteQRCode encodes JSON ({v, tripId, inviteCode}), not a bare code, so
 * scanned text is parsed accordingly. Falls back to treating the raw scan
 * as the code itself, in case a trip's invite is ever shared as plain text
 * turned into a QR by some other means.
 */
export default function ScanQRScreen({ navigation }: Props) {
  const device = useCameraDevice('back');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    Camera.requestCameraPermission().then(status => {
      setHasPermission(status === 'granted');
    });
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      if (scanned) return;
      const raw = codes[0]?.value;
      if (!raw) return;

      let inviteCode = raw.trim();
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.inviteCode) inviteCode = String(parsed.inviteCode);
      } catch {
        // Not JSON - treat the raw scanned text as the code itself.
      }

      setScanned(true);
      navigation.replace('JoinTrip', { inviteCode: inviteCode.toUpperCase() });
    },
  });

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera access is off. Enable it in your device settings to scan a trip QR code.</Text>
      </View>
    );
  }

  if (hasPermission === null || !device) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Preparing camera…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={!scanned} codeScanner={codeScanner} />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>Point your camera at the trip's QR code</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  message: { fontSize: 15, textAlign: 'center', color: '#555' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderWidth: 2, borderColor: '#fff', borderRadius: 16, backgroundColor: 'transparent' },
  hint: { marginTop: 16, color: '#fff', fontSize: 14, fontWeight: '600' },
});