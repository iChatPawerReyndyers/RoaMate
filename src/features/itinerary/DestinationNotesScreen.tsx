import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';

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
        {loading ? <ActivityIndicator size="large" style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textArea}
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Write a note or coordinate details..."
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Note'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notesSection}>
          {notes.map(note => (
            <View key={note.id} style={styles.noteCard}>
              <Text style={styles.noteBody}>{note.body}</Text>
              <Text style={styles.noteMeta}>
                {note.authorUserId} {note.createdAt ? `· ${new Date(note.createdAt).toLocaleString()}` : ''}
              </Text>
            </View>
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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  spinner: { marginVertical: 24 },
  error: { color: '#b00020', marginBottom: 12 },
  inputSection: { marginBottom: 20 },
  textArea: { minHeight: 110, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#2f6fed', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  notesSection: { gap: 12 },
  noteCard: { backgroundColor: '#f5f8ff', borderRadius: 14, padding: 14 },
  noteBody: { fontSize: 14, color: '#222', marginBottom: 8 },
  noteMeta: { fontSize: 12, color: '#666' },
  empty: { color: '#555', fontStyle: 'italic' },
});
