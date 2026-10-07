import React, { useEffect, useRef } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { haptics, useTheme } from '../design';
import { Icon } from '../components/Icon';
import { Row, Stack } from '../components/Stack';
import { Text } from '../components/Text';
import { TAB_DESTINATIONS } from './types';

/**
 * Compact primary navigation. Deliberately NOT a chunky generic bottom bar:
 * slim surface strip, hairline divider, small icon + label, and a subtle
 * accent indicator that springs to the active destination. Tabs announce
 * themselves as tabs and haptic-tick on switch.
 */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { colors, spacing, radius, zIndex, spring } = useTheme();
  const indicatorX = useSharedValue(0);
  const indicatorReady = useRef(false);
  const centers = useRef<Array<number>>([]);

  useEffect(() => {
    const target = centers.current[state.index];
    if (target !== undefined) {
      if (!indicatorReady.current) {
        indicatorReady.current = true;
        indicatorX.value = target; // no animation on first layout
      } else {
        indicatorX.value = withSpring(target, spring.snappy);
      }
    }
  }, [state.index, indicatorX, spring.snappy]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value - 16 }],
  }));

  const handleLayout = (index: number, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    centers.current[index] = x + width / 2;
    if (index === state.index) {
      indicatorReady.current = false; // let the effect snap on first pass
      indicatorX.value = x + width / 2;
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
        zIndex: zIndex.sticky,
        elevation: zIndex.sticky,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 32,
            height: 3,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
          },
          indicatorStyle,
        ]}
      />
      <Row style={{ height: 60 }}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const destination = TAB_DESTINATIONS.find(
            item => item.name === route.name,
          );
          const label = destination?.label ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onLayout={event => handleLayout(index, event)}
              onPress={() => {
                if (focused) {
                  navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  return;
                }
                haptics.selection();
                navigation.navigate(route.name, route.params);
              }}
              style={({ pressed }) => ({
                flex: 1,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Stack
                gap={2}
                align="center"
                style={{ paddingTop: spacing.sm + 2 }}
              >
                {destination ? (
                  <Icon
                    glyph={destination.icon}
                    size="sm"
                    color={focused ? 'accent' : 'muted'}
                  />
                ) : null}
                <Text variant="metadata" color={focused ? 'accent' : 'muted'}>
                  {label}
                </Text>
              </Stack>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}
