import React from 'react';
import { Modal as RNModal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuRadii } from '@/theme/neumorphic';
import { CategoryOption, Member, avatarColor, initialOf } from './checklistViews';

interface Props {
  visible: boolean;
  /** Defaults to "Who's in charge?" */
  title?: string;
  /** false hides the people list - used for PERSONAL items, which belong to one person and can't be assigned. Defaults to true. */
  showMembers?: boolean;
  /** One line under the title - the item's name (and its category). */
  subtitle: string;
  members: Member[];
  currentUserId: string;
  /** null = nobody yet. */
  assignedToUserId: string | null;
  /** Called the moment a row is tapped; the sheet stays open so the person can also change the category, then tap Done. */
  onAssign: (userId: string | null) => void;
  /** Category chips: pass all three of these to show them, none to hide the section (the add bar's picker only needs "in charge"). */
  categoryLabel?: string;
  categoryOptions?: CategoryOption[];
  category?: string | null;
  onChangeCategory?: (value: string | null) => void;
  onClose: () => void;
}

export function Avatar({ userId, name, size = 22 }: { userId: string | null; name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(userId) }]}>
      <Text style={styles.avatarText}>{userId ? initialOf(name) : '?'}</Text>
    </View>
  );
}

/**
 * CHK-05: the "Who's in charge?" bottom sheet - the trip's members (you
 * first) plus "Nobody yet", and optionally the item's category / store
 * section. Used for an existing item's details and, without the category
 * chips, for the add bar's "In charge" choice.
 */
export default function ChecklistItemSheet({
  visible,
  title = "Who's in charge?",
  showMembers = true,
  subtitle,
  members,
  currentUserId,
  assignedToUserId,
  onAssign,
  categoryLabel,
  categoryOptions,
  category,
  onChangeCategory,
  onClose,
}: Props) {
  // You first, then everyone else in trip order.
  const ordered = [...members.filter(m => m.userId === currentUserId), ...members.filter(m => m.userId !== currentUserId)];
  const showCategory = !!categoryOptions && !!onChangeCategory;

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Inner Pressable swallows taps so touching the sheet itself doesn't hit the backdrop's onClose. */}
        <Pressable style={styles.sheetWrapper} onPress={() => {}}>
          <NeumorphicView variant="raised" radius={neuRadii.xl} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>

            {showMembers ? (
              <ScrollView style={styles.memberList} bounces={false}>
                {ordered.map((member, index) => {
                  const selected = member.userId === assignedToUserId;
                  const isYou = member.userId === currentUserId;
                  return (
                    <TouchableOpacity
                      key={member.userId}
                      style={[styles.memberRow, index > 0 && styles.memberRowDivider]}
                      onPress={() => onAssign(member.userId)}
                      accessibilityRole="button"
                      accessibilityLabel={isYou ? 'Assign to you' : `Assign to ${member.displayName}`}
                      accessibilityState={{ selected }}
                    >
                      <Avatar userId={member.userId} name={member.displayName} size={28} />
                      <Text style={styles.memberName}>{isYou ? `${member.displayName} (you)` : member.displayName}</Text>
                      {selected ? <Text style={styles.check}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[styles.memberRow, ordered.length > 0 && styles.memberRowDivider]}
                  onPress={() => onAssign(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Nobody yet"
                  accessibilityState={{ selected: assignedToUserId === null }}
                >
                  <Avatar userId={null} name="" size={28} />
                  <Text style={styles.memberName}>Nobody yet</Text>
                  {assignedToUserId === null ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              </ScrollView>
            ) : null}

            {showCategory ? (
              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>{categoryLabel}</Text>
                <View style={styles.chipRow}>
                  {(categoryOptions ?? []).map(option => {
                    const selected = option.value === (category ?? null);
                    return (
                      <TouchableOpacity
                        key={option.label}
                        onPress={() => onChangeCategory?.(option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`${categoryLabel}: ${option.label}`}
                        accessibilityState={{ selected }}
                      >
                        <NeumorphicView
                          variant={selected ? 'raised' : 'inset'}
                          size="sm"
                          radius={neuRadii.sm}
                          backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                          style={styles.chip}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                        </NeumorphicView>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <NeuButton label="Done" onPress={onClose} style={styles.doneButton} />
          </NeumorphicView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheetWrapper: { width: '100%' },
  sheet: { padding: 16, paddingBottom: 24, maxHeight: '85%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#C9D0DE', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: neuColors.textPrimary },
  subtitle: { fontSize: 12, color: neuColors.textMuted, marginTop: 2, marginBottom: 8 },
  memberList: { flexGrow: 0 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  memberRowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  memberName: { flex: 1, fontSize: 15, color: neuColors.textPrimary },
  check: { fontSize: 18, color: neuColors.accent, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 11, fontWeight: '700', color: neuColors.white },
  categorySection: { marginTop: 12 },
  categoryLabel: { fontSize: 11, fontWeight: '600', color: neuColors.textMuted, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, color: neuColors.textPrimary },
  chipTextSelected: { color: neuColors.white, fontWeight: '600' },
  doneButton: { marginTop: 14 },
});