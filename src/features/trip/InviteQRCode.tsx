import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  tripId: string;
  inviteCode: string;
}

/**
 * TRIP-01: renders entirely from data already on the device (tripId +
 * inviteCode returned at trip creation) - no network call, so this works
 * offline just like scanning it does on the receiving end. The payload is
 * JSON rather than a bare code so a scanner can route straight to the
 * join flow without a lookup step.
 */
export default function InviteQRCode({ tripId, inviteCode }: Props) {
  const payload = JSON.stringify({ v: 1, tripId, inviteCode });

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
