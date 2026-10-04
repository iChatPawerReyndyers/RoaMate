import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAccount, UsernameTakenError, InvalidCredentialsError } from '@/app/AccountContext';
import { TouchableOpacity } from 'react-native';
import { NetworkUnavailableError, TEST_MODE, apiClient } from '@/services/api/client';
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
  const { register, login, resetPasswordDev } = useAccount();
  const [mode, setMode] = useState<Mode>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // DEV-ONLY: whether the "Reset password (testing)" form is showing instead
  // of the normal sign-up/log-in form. See AccountContext.resetPasswordDev
  // and AuthController.devResetPassword for why this has its own big
  // warning - it skips proving the person actually owns the account.
  const [resetMode, setResetMode] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  // Live "is this username free?" hint on sign-up - a convenience only.
  // /register still independently rejects a duplicate at submit time (see
  // UsernameTakenError below), since a name could be taken by someone else
  // in the moment between this check and the actual submit - this never
  // replaces that safety net, it just gives earlier feedback.
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    if (mode !== 'signup' || TEST_MODE) {
      setUsernameAvailable(null);
      return;
    }
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameAvailable(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await apiClient.get<{ available: boolean }>(
          `/api/v1/auth/username-available?username=${encodeURIComponent(trimmed)}`,
        );
        if (!cancelled) {
          setUsernameAvailable(result.available);
        }
      } catch {
        // Purely a nice-to-have hint - if the check itself fails (offline, server hiccup),
        // say nothing rather than showing a misleading availability status.
        if (!cancelled) {
          setUsernameAvailable(null);
        }
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, mode]);

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
  }

  function openResetMode() {
    setResetMode(true);
    setResetUsername(username);
    setResetNewPassword('');
    setMessage(null);
  }

  function closeResetMode() {
    setResetMode(false);
    setMessage(null);
  }

  async function handleResetSubmit() {
    const trimmedUsername = resetUsername.trim();
    if (!trimmedUsername || resetNewPassword.length < 8) {
      setMessage({ text: 'Enter a username and a password of at least 8 characters.', tone: 'error' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await resetPasswordDev(trimmedUsername, resetNewPassword);
      // On success AccountContext's `account` flips to non-null and RootNavigator swaps this screen out.
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        setMessage({ text: err.message, tone: 'error' });
      } else if (err instanceof NetworkUnavailableError) {
        setMessage({ text: "Can't reach the server. Check your connection and try again.", tone: 'error' });
      } else {
        console.warn('Dev password reset failed', err);
        setMessage({ text: 'Something went wrong. Please try again.', tone: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
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
          {resetMode ? (
            <>
              <Text style={styles.title}>Reset password</Text>
              <View style={styles.devWarningBanner}>
                <Text style={styles.devWarningBannerText}>
                  ⚠️ Testing only: this sets a new password with no verification. Do not use once real people are on
                  this trip.
                </Text>
              </View>

              <Text style={styles.label}>Username</Text>
              <NeuTextInput
                value={resetUsername}
                onChangeText={setResetUsername}
                placeholder="alex"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>New password</Text>
              <NeuTextInput
                value={resetNewPassword}
                onChangeText={setResetNewPassword}
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
                label="Reset & log in"
                variant="primary"
                onPress={handleResetSubmit}
                loading={submitting}
                style={styles.submitButton}
              />
              <TouchableOpacity onPress={closeResetMode} accessibilityRole="button" style={styles.resetLinkWrap}>
                <Text style={styles.cancelLink}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
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
              {mode === 'signup' && usernameAvailable !== null ? (
                <Text style={usernameAvailable ? styles.usernameAvailable : styles.usernameTaken}>
                  {usernameAvailable ? '✓ Available' : 'Already taken'}
                </Text>
              ) : null}

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

              {mode === 'login' && (
                <TouchableOpacity onPress={openResetMode} accessibilityRole="button" style={styles.resetLinkWrap}>
                  <Text style={styles.resetLink}>Reset password (testing)</Text>
                </TouchableOpacity>
              )}
            </>
          )}
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
  resetLinkWrap: { marginTop: 14, alignItems: 'center' },
  resetLink: { fontSize: 12, color: neuColors.accent, textDecorationLine: 'underline' },
  cancelLink: { fontSize: 12, color: neuColors.textMuted },
  devWarningBanner: {
    backgroundColor: '#FDECEA',
    borderWidth: 1,
    borderColor: '#F3C6C0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  devWarningBannerText: { fontSize: 11, color: '#9A3B2E', lineHeight: 15 },
  usernameAvailable: { fontSize: 11, color: '#3E9B6C', marginTop: 4 },
  usernameTaken: { fontSize: 11, color: neuColors.danger, marginTop: 4 },
});