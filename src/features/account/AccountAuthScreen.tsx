import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount, UsernameTakenError, InvalidCredentialsError } from '@/app/AccountContext';
import { NetworkUnavailableError, TEST_MODE } from '@/services/api/client';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeuSegmentedControl from '@/components/neumorphic/NeuSegmentedControl';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuSpacing } from '@/theme/neumorphic';

type Mode = 'signup' | 'login';

const MODE_OPTIONS: { key: Mode; label: string }[] = [
  { key: 'signup', label: 'Sign up' },
  { key: 'login', label: 'Log in' },
];

export default function AccountAuthScreen() {
  const { register, login } = useAccount();
  const [mode, setMode] = useState<Mode>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
  }

  async function handleSubmit() {
    let trimmedUsername = username.trim();
    let effectivePassword = password;

    if (TEST_MODE) {
      // Testing on-device with no backend deployed (see mockData.ts) -
      // nothing here actually authenticates against a real server, so
      // requiring a well-formed username/password is friction with no
      // purpose. Falls back to a throwaway identity only for whichever
      // field is actually blank, so a partially-filled form still uses
      // what was typed rather than discarding it.
      trimmedUsername = trimmedUsername || 'tester';
      effectivePassword = effectivePassword || 'test-mode-password';
    } else {
      if (!trimmedUsername) {
        setMessage({ text: 'Enter a username', tone: 'error' });
        return;
      }
      if (password.length < 8) {
        setMessage({ text: 'Password must be at least 8 characters', tone: 'error' });
        return;
      }
    }

    setSubmitting(true);
    setMessage(null);
    try {
      if (mode === 'signup') {
        await register(trimmedUsername, effectivePassword);
      } else {
        await login(trimmedUsername, effectivePassword);
      }
      // On success AccountContext's `account` flips to non-null and
      // RootNavigator swaps this screen out - nothing further to do here.
    } catch (err) {
      if (err instanceof UsernameTakenError) {
        setMessage({ text: `"${trimmedUsername}" is taken. Enter its password to log in.`, tone: 'info' });
        setMode('login');
      } else if (err instanceof InvalidCredentialsError) {
        setMessage({ text: 'Incorrect username or password', tone: 'error' });
      } else if (err instanceof NetworkUnavailableError) {
        setMessage({ text: "Can't reach the server. Check your connection and try again.", tone: 'error' });
      } else {
        console.warn('Auth request failed', err);
        setMessage({ text: 'Something went wrong. Please try again.', tone: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <NeuCard size="lg" style={styles.card}>
          <Text style={styles.title}>RoaMate</Text>
          <Text style={styles.tagline}>{mode === 'signup' ? 'Create an account to get started' : 'Log in to your account'}</Text>
          {TEST_MODE && (
            <View style={styles.testModeBanner}>
              <Text style={styles.testModeBannerText}>
                Test mode: tap {mode === 'signup' ? 'Create Account' : 'Log In'} to skip straight in
              </Text>
            </View>
          )}

          <View style={styles.tabWrap}>
            <NeuSegmentedControl options={MODE_OPTIONS} value={mode} onChange={switchMode} />
          </View>

          <Text style={styles.label}>Username</Text>
          <NeuTextInput
            value={username}
            onChangeText={setUsername}
            placeholder="alex"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <NeuTextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
          />

          {message ? (
            <Text style={[styles.message, message.tone === 'error' ? styles.messageError : styles.messageInfo]}>
              {message.text}
            </Text>
          ) : null}

          <NeuButton
            label={mode === 'signup' ? 'Create account' : 'Log in'}
            variant="primary"
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitButton}
          />
        </NeuCard>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  flex: { flex: 1, justifyContent: 'center' },
  card: { marginHorizontal: 24, padding: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', color: neuColors.textPrimary },
  tagline: { fontSize: 13, color: neuColors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  testModeBanner: {
    backgroundColor: '#fff6e0',
    borderRadius: 10,
    paddingVertical: 7,
    marginTop: -8,
    marginBottom: 16,
  },
  testModeBannerText: { fontSize: 11, color: '#8a5a00', textAlign: 'center', fontWeight: '600' },
  tabWrap: { marginBottom: 18 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  message: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  messageError: { color: neuColors.danger },
  messageInfo: { color: neuColors.accent },
  submitButton: { marginTop: 12 },
});