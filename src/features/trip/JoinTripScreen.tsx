import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient, ApiError } from '@/services/api/client';
import { useAccount } from '@/app/AccountContext';
import type { AuthStackParamList } from '@/app/navigation/AuthStack';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuSpacing } from '@/theme/neumorphic';

interface TripJoinedPayload {
  id: string;
  inviteCode: string;
  name?: string;
  description?: string;
  defaultCurrency: string;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'JoinTrip'> & {
  onJoined: (trip: TripJoinedPayload) => void;
};

/**
 * TRIP-01: join via 6-character invite code, either typed in directly or
 * prefilled from ScanQRScreen's route param. A scanned code still lands
 * here rather than auto-submitting, so the person can double check (or
 * correct, if the QR was for the wrong trip) before actually joining.
 *
 * inviteSecret, when present, came from the QR payload and travels with
 * this screen only via route params - it's never rendered or editable, so
 * editing the invite code by hand (e.g. to fix a scan) correctly drops it
 * and falls back to a normal code-only join.
 *
 * "Your name" defaults to the logged-in account's username rather than
 * starting blank - this screen is only ever reachable after login (see
 * RootNavigator), so that username is always available. Still a plain
 * editable field, not locked to it: a per-trip nickname is a reasonable
 * thing to want (e.g. a family trip where "Mom" reads better than an
 * account username).
 */
export default function JoinTripScreen({ route, onJoined }: Props) {
  const { account } = useAccount();
  const [code, setCode] = useState(route.params?.inviteCode ?? '');
  const [displayName, setDisplayName] = useState(account?.username || '');
  const [submitting, setSubmitting] = useState(false);
  const inviteSecret = route.params?.inviteSecret;

  const handleJoin = async () => {
    if (!code.trim() || !displayName.trim()) {
      Alert.alert('Missing info', 'Enter both the invite code and your name.');
      return;
    }
    setSubmitting(true);
    try {
      const joined = await apiClient.post<TripJoinedPayload>('/api/v1/trips/join', {
        inviteCode: code.trim().toUpperCase(),
        displayName: displayName.trim(),
        // Only sent when the code still matches what the QR scan produced -
        // if the person hand-edited the field, treat it as a fresh typed
        // code instead of silently reusing a secret for a different code.
        inviteSecret: code.trim().toUpperCase() === route.params?.inviteCode?.toUpperCase() ? inviteSecret : undefined,
      });
      onJoined(joined);
    } catch (err) {
      // Previously uncaught here - matches the same unhandled-promise-rejection
      // pattern that crashed MapScreen before it got a catch block.
      console.warn('Failed to join trip', err);
      if (err instanceof ApiError && err.status === 400) {
        Alert.alert('Trip not found', "That invite code doesn't match any trip. Double check it and try again.");
      } else {
        Alert.alert("Couldn't join trip", 'Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.fieldLabel}>Invite code</Text>
        <NeuTextInput
          value={code}
          onChangeText={setCode}
          placeholder="AB3XQ9"
          autoCapitalize="characters"
          maxLength={6}
        />
        <Text style={styles.fieldLabel}>Your name</Text>
        <NeuTextInput value={displayName} onChangeText={setDisplayName} placeholder="Alex" />
        <NeuButton
          label="Join Trip"
          variant="primary"
          onPress={handleJoin}
          loading={submitting}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  content: { padding: neuSpacing.lg },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  button: { marginTop: 22 },
});