import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

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
      <View style={styles.qrWrapper}>
        <QRCode value={payload} size={168} />
      </View>
      <Text style={styles.hint}>Works offline - no signal needed to scan or type this code.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 16 },
  qrWrapper: { padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee' },
  hint: { fontSize: 12, color: '#777', marginTop: 10, textAlign: 'center' },
});