import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAccount, UsernameTakenError, InvalidCredentialsError } from '@/app/AccountContext';
import { NetworkUnavailableError } from '@/services/api/client';

type Mode = 'signup' | 'login';

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
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setMessage({ text: 'Enter a username', tone: 'error' });
      return;
    }
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters', tone: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      if (mode === 'signup') {
        await register(trimmedUsername, password);
      } else {
        await login(trimmedUsername, password);
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
        <View style={styles.card}>
          <Text style={styles.title}>RoaMate</Text>
          <Text style={styles.tagline}>{mode === 'signup' ? 'Create an account to get started' : 'Log in to your account'}</Text>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => switchMode('signup')}
            >
              <Text style={[styles.tabLabel, mode === 'signup' && styles.tabLabelActive]}>Sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => switchMode('login')}
            >
              <Text style={[styles.tabLabel, mode === 'login' && styles.tabLabelActive]}>Log in</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="alex"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
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

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitLabel}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f8ff' },
  flex: { flex: 1, justifyContent: 'center' },
  card: { marginHorizontal: 24, backgroundColor: '#fff', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#d7e3ff' },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  tagline: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f0f3fb', borderRadius: 10, padding: 3, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabLabel: { fontSize: 13, color: '#666' },
  tabLabelActive: { color: '#1d4ed8', fontWeight: '700' },
  label: { fontSize: 12, color: '#666', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#d7e3ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 14,
  },
  message: { fontSize: 12, marginBottom: 12 },
  messageError: { color: '#b00020' },
  messageInfo: { color: '#1d4ed8' },
  submitButton: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
});