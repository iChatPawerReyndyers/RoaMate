import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Item {
  id: string;
  label: string;
  checked: boolean;
  assignedToUserId?: string;
}

interface Props {
  title: string;
  items: Item[];
  onToggle: (id: string) => void;
  onConvertToExpense?: (id: string) => void;
}

/** CHK-01..04: shared, checkable packing/grocery list with optional expense conversion. */
export default function ChecklistScreen({ title, items, onToggle, onConvertToExpense }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>{title}</Text>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.checkRow} onPress={() => onToggle(item.id)}>
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
              <Text style={[styles.label, item.checked && styles.labelChecked]}>{item.label}</Text>
            </TouchableOpacity>
            {onConvertToExpense && (
              <TouchableOpacity onPress={() => onConvertToExpense(item.id)}>
                <Text style={styles.convertLink}>+ Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#999' },
  checkboxChecked: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  label: { fontSize: 15 },
  labelChecked: { textDecorationLine: 'line-through', color: '#999' },
  convertLink: { color: '#2f6fed', fontSize: 12, fontWeight: '600' },
});
