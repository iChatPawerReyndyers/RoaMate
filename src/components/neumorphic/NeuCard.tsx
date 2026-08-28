import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuRadii } from '@/theme/neumorphic';

interface Props {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
}

/** Generic raised card - the gallery's Modal Card and the layout preview's list-item cards both use this same shape, just different padding/content. */
export default function NeuCard({ children, style, size = 'md', radius = neuRadii.xl }: Props) {
  return (
    <NeumorphicView variant="raised" size={size} radius={radius} style={style}>
      {children}
    </NeumorphicView>
  );
}
