import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface Props {
  tripId: string;
  inviteCode: string;
  inviteSecret: string;
}

/**
 * TRIP-01: renders entirely from data already on the device (tripId +
 * inviteCode + inviteSecret returned at trip creation) - no network call,
 * so this works offline just like scanning it does on the receiving end.
 * The payload is JSON rather than a bare code so a scanner can route
 * straight to the join flow without a lookup step.
 *
 * inviteSecret is the "trip cryptographic keys" the spec calls for: a
 * high-entropy value that only ever travels inside this QR image, never
 * shown as on-screen text. ScanQRScreen forwards it through to the join
 * request, where the backend checks it against the trip - so a QR scan
 * proves possession of the actual invite image, not just knowledge of the
 * short human-typeable code. Bumped payload version to v:2 since older
 * app builds that only understand {v:1, tripId, inviteCode} will simply
 * ignore the extra field.
 */
export default function InviteQRCode({ tripId, inviteCode, inviteSecret }: Props) {
  const payload = JSON.stringify({ v: 2, tripId, inviteCode, inviteSecret });

  return (
    <View style={styles.container}>
      <NeumorphicView variant="inset" radius={neuRadii.xl} style={styles.qrWrapper}>
        {/* QR keeps plain white/black - real-world scan reliability matters more than matching the palette here */}
        <View style={styles.qrInner}>
          <QRCode value={payload} size={160} />
        </View>
      </NeumorphicView>
      <Text style={styles.hint}>Works offline - no signal needed to scan or type this code.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 16 },
  qrWrapper: { padding: 16 },
  qrInner: { backgroundColor: neuColors.white, padding: 10, borderRadius: 10 },
  hint: { fontSize: 12, color: neuColors.textMuted, marginTop: 10, textAlign: 'center' },
});