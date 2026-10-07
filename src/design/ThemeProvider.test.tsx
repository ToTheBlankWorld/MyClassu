import React from 'react';
import { Text, useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { ThemeProvider, useTheme, useThemePreference } from './ThemeProvider';

/**
 * Theme resolution behavior: system-following by default, explicit
 * light/dark overrides, and a live setPreference for the Settings screen.
 *
 * The React Native jest preset replaces the useColorScheme hook with a
 * jest.fn (defaulting to 'light'), which we drive to simulate the OS.
 */

const useColorSchemeMock = useColorScheme as jest.Mock;

function ThemeProbe() {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();

  return (
    <>
      <Text testID="mode">{theme.isDark ? 'dark' : 'light'}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="switch" onPress={() => setPreference('dark')}>
        switch
      </Text>
    </>
  );
}

function renderTree() {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
  });
  return tree;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    useColorSchemeMock.mockReset().mockReturnValue('light');
  });

  it('follows the system scheme by default', () => {
    const tree = renderTree();
    expect(tree.root.findByProps({ testID: 'mode' }).props.children).toBe(
      'light',
    );
    expect(tree.root.findByProps({ testID: 'preference' }).props.children).toBe(
      'system',
    );
  });

  it('resolves system dark', () => {
    useColorSchemeMock.mockReturnValue('dark');
    const tree = renderTree();
    expect(tree.root.findByProps({ testID: 'mode' }).props.children).toBe(
      'dark',
    );
  });

  it('lets the user override the system', () => {
    useColorSchemeMock.mockReturnValue('light');
    const tree = renderTree();
    act(() => {
      tree.root.findByProps({ testID: 'switch' }).props.onPress();
    });
    expect(tree.root.findByProps({ testID: 'mode' }).props.children).toBe(
      'dark',
    );
    expect(tree.root.findByProps({ testID: 'preference' }).props.children).toBe(
      'dark',
    );
  });

  it('falls back to light when the system reports null', () => {
    useColorSchemeMock.mockReturnValue(null);
    const tree = renderTree();
    expect(tree.root.findByProps({ testID: 'mode' }).props.children).toBe(
      'light',
    );
  });
});
