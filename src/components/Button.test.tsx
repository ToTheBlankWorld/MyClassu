import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Button } from './Button';
import { ThemeProvider } from '../design';

/**
 * Button behavior: stable accessible name, disabled/loading semantics, and
 * the haptic hook firing on press-in.
 */

const renderButton = (props: React.ComponentProps<typeof Button>) => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(
      <ThemeProvider>
        <Button {...props} />
      </ThemeProvider>,
    );
  });
  return tree;
};

describe('Button', () => {
  it('renders its label as the accessible name', () => {
    const tree = renderButton({
      children: 'Save schedule',
      onPress: () => undefined,
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityLabel).toBe('Save schedule');
  });

  it('marks itself disabled when disabled', () => {
    const tree = renderButton({
      children: 'Go',
      disabled: true,
      onPress: () => undefined,
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState.disabled).toBe(true);
    expect(pressable.props.disabled).toBe(true);
  });

  it('exposes busy state while loading but keeps the stable label', () => {
    const tree = renderButton({
      children: 'Saving',
      loading: true,
      onPress: () => undefined,
    });
    const pressable = tree.root.findByProps({ accessibilityRole: 'button' });
    expect(pressable.props.accessibilityState.busy).toBe(true);
    // The label stays mounted (invisibly) so the button never changes width.
    expect(pressable.props.accessibilityLabel).toBe('Saving');
  });

  it('fires the light haptic on press-in', () => {
    const haptics = require('../design/haptics/haptics').haptics;
    const lightSpy = jest
      .spyOn(haptics, 'light')
      .mockImplementation(() => undefined);
    const tree = renderButton({ children: 'Go', onPress: () => undefined });
    act(() => {
      tree.root
        .findByProps({ accessibilityRole: 'button' })
        .props.onPressIn({ nativeEvent: {} });
    });
    expect(lightSpy).toHaveBeenCalled();
  });
});
