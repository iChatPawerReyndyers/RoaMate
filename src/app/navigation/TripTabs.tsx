import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ItineraryHubScreen from '@/features/itinerary/ItineraryHubScreen';
import ExpensesHubScreen from '@/features/finance/ExpensesHubScreen';
import ChecklistContainer from '@/features/checklists/ChecklistContainer';

export type TripTabsParamList = {
  ItineraryTab: undefined;
  ExpensesTab: undefined;
  ChecklistTab: undefined;
};

const Tab = createBottomTabNavigator<TripTabsParamList>();

interface Props {
  tripId: string;
  onSafetyPress: () => void;
}

const TAB_LABELS: Record<keyof TripTabsParamList, string> = {
  ItineraryTab: 'Itinerary',
  ExpensesTab: 'Expenses',
  ChecklistTab: 'Checklist',
};

function TabIcon({ route, focused }: { route: keyof TripTabsParamList; focused: boolean }) {
  const color = focused ? '#1d4ed8' : '#888';
  if (route === 'ItineraryTab') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M9 20l-6-2V6l6 2m0 12l6-2m-6 2V8m6 10l6 2V8l-6-2m0 12V6m0 0L9 8" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    );
  }
  if (route === 'ExpensesTab') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Rect x={3} y={6} width={18} height={13} rx={2} stroke={color} strokeWidth={2} />
        <Path d="M3 10h18" stroke={color} strokeWidth={2} />
        <Circle cx={16} cy={14} r={1.5} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={4} width={16} height={16} rx={3} stroke={color} strokeWidth={2} />
      <Path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SafetyIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"
        stroke="#b00020"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M9.5 12l1.8 1.8L15 10" stroke="#b00020" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CustomTabBar({ state, navigation, onSafetyPress }: BottomTabBarProps & { onSafetyPress: () => void }) {
  const insets = useSafeAreaInsets();
  // Pad below the tab bar by whichever is larger: the device's actual bottom
  // inset (Android gesture bar / iOS home indicator) or a minimum comfortable
  // gap for classic 3-button nav / older devices where the inset is 0.
  const bottomPadding = Math.max(insets.bottom, 12);
  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const routeName = route.name as keyof TripTabsParamList;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabButton}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          >
            <TabIcon route={routeName} focused={focused} />
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{TAB_LABELS[routeName]}</Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.safetyDivider} />
      <TouchableOpacity style={styles.tabButton} onPress={onSafetyPress}>
        <SafetyIcon />
        <Text style={styles.safetyLabel}>Safety</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TripTabs({ tripId, onSafetyPress }: Props) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <CustomTabBar {...props} onSafetyPress={onSafetyPress} />}
    >
      <Tab.Screen name="ItineraryTab">{() => <ItineraryHubScreen tripId={tripId} />}</Tab.Screen>
      <Tab.Screen name="ExpensesTab">{() => <ExpensesHubScreen tripId={tripId} />}</Tab.Screen>
      <Tab.Screen name="ChecklistTab">{() => <ChecklistContainer tripId={tripId} />}</Tab.Screen>
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e2e2',
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabLabel: { fontSize: 11, color: '#888' },
  tabLabelActive: { color: '#1d4ed8', fontWeight: '700' },
  safetyDivider: { width: 1, height: 28, backgroundColor: '#e2e2e2' },
  safetyLabel: { fontSize: 11, color: '#b00020', fontWeight: '700' },
});