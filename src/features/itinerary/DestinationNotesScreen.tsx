import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

interface LocationNote {
  id: string;
  authorUserId: string;
  body: string;
  createdAt?: string;
}

interface Props {
  destinationId: string;
  destinationName: string;
}

export default function DestinationNotesScreen({ destinationId, destinationName }: Props) {
  const [notes, setNotes] = useState<LocationNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<LocationNote[]>(`/api/v1/itinerary/destinations/${destinationId}/notes`);
      setNotes(result);
    } catch (err) {
      console.warn('Failed to load destination notes', err);
      setError('Unable to load notes right now.');
    } finally {
      setLoading(false);
    }
  }, [destinationId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleSave = async () => {
    if (!newNote.trim()) {
      setError('Please enter a note before saving.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const authorUserId = await getCurrentUserId();
      await apiClient.post('/api/v1/itinerary/notes', {
        destinationId,
        authorUserId,
        body: newNote.trim(),
      });
      setNewNote('');
      await loadNotes();
    } catch (err) {
      console.warn('Failed to add destination note', err);
      setError('Unable to save note right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Notes for {destinationName}</Text>
        {loading ? <ActivityIndicator size="large" color={neuColors.accent} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.inputSection}>
          <NeumorphicView variant="inset" radius={neuRadii.lg} style={styles.textAreaWrap}>
            <TextInput
              style={styles.textArea}
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Write a note or coordinate details..."
              placeholderTextColor={neuColors.textMuted}
              multiline
              numberOfLines={4}
            />
          </NeumorphicView>
          <NeuButton
            label={saving ? 'Saving…' : 'Save Note'}
            variant="primary"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />
        </View>

        <View style={styles.notesSection}>
          {notes.map(note => (
            <NeuCard key={note.id} size="md" style={styles.noteCard}>
              <View style={styles.noteAvatarRow}>
                <NeumorphicView variant="inset" radius={11} style={styles.avatar}>
                  <Text style={styles.avatarText}>{note.authorUserId.slice(0, 1).toUpperCase()}</Text>
                </NeumorphicView>
                <Text style={styles.noteMeta}>
                  {note.authorUserId}
                  {note.createdAt ? ` · ${new Date(note.createdAt).toLocaleString()}` : ''}
                </Text>
              </View>
              <Text style={styles.noteBody}>{note.body}</Text>
            </NeuCard>
          ))}
          {notes.length === 0 && !loading ? (
            <Text style={styles.empty}>No notes yet. Add the first one!</Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  content: { padding: neuSpacing.lg, paddingBottom: 40 },
  header: { fontSize: 20, fontWeight: '700', marginBottom: 18, color: neuColors.textPrimary },
  spinner: { marginVertical: 24 },
  error: { color: neuColors.danger, marginBottom: 12 },
  inputSection: { marginBottom: 20 },
  textAreaWrap: { minHeight: 110 },
  textArea: { flex: 1, padding: 12, fontSize: 13, color: neuColors.textPrimary, textAlignVertical: 'top' },
  saveButton: { marginTop: 12 },
  notesSection: { gap: neuSpacing.md },
  noteCard: { padding: 14 },
  noteAvatarRow: { flexDirection: 'row', alignItems: 'center', gap: neuSpacing.sm, marginBottom: 8 },
  avatar: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '700', color: neuColors.textMuted },
  noteBody: { fontSize: 14, color: neuColors.textPrimary },
  noteMeta: { fontSize: 12, color: neuColors.textMuted },
  empty: { color: neuColors.textMuted, fontStyle: 'italic' },
});