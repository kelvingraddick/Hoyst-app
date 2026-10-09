import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {NudgeMark} from '../src/design/components/NudgeMark';
import {NudgeActionButton} from '../src/design/components/NudgeActionButton';

jest.mock('../src/store/settings-store', () => ({
  useSettingsStore: (selector: (state: {appearance: 'light'}) => unknown) =>
    selector({appearance: 'light'}),
}));

function render(element: React.ReactElement) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  return tree;
}

it.each([15, 17, 18])(
  'renders a decorative native nudge emoji at %s px',
  size => {
    const tree = render(<NudgeMark size={size} />);
    const text = tree.root.findByType(Text);
    expect(text.props.children).toBe('🫵');
    expect(text.props.accessible).toBe(false);
    expect(text.props.accessibilityElementsHidden).toBe(true);
    expect(text.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(text.props.allowFontScaling).toBe(false);
    const style = StyleSheet.flatten(text.props.style);
    expect(style).toMatchObject({fontSize: size, lineHeight: size});
    expect(
      StyleSheet.flatten(tree.root.findByType(View).props.style),
    ).toMatchObject({
      width: size,
      height: size,
    });
    expect(style.fontFamily).toBeUndefined();
    expect(style.color).toBeUndefined();
  },
);

it.each([
  ['card', 17, 44, 136],
  ['compact', 15, 42, 104],
  ['mini', undefined, 34, 96],
] as const)(
  'preserves %s button geometry and icon visibility',
  (size, iconSize, height, width) => {
    const onPress = jest.fn();
    const tree = render(
      <NudgeActionButton
        size={size}
        label="Nudge"
        targetCount={1}
        onPress={onPress}
      />,
    );
    const button = tree.root.findByType(Pressable);
    expect(button.props.accessibilityLabel).toBe('Nudge 1 Member');
    const style = StyleSheet.flatten(button.props.style({pressed: false}));
    expect(style.minWidth).toBe(width);
    expect(style.minHeight).toBeGreaterThanOrEqual(height);
    expect(
      tree.root.findAllByType(NudgeMark).map(mark => mark.props.size),
    ).toEqual(iconSize ? [iconSize] : []);
    act(() => {
      button.props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  },
);

it.each([
  {isLoading: true, busy: true, label: 'Sending nudge to 1 Member'},
  {isSent: true, busy: false, label: 'Nudge sent to 1 Member'},
  {disabled: true, busy: false, label: 'Nudge 1 Member'},
])('preserves unavailable button state %j', ({busy, label, ...props}) => {
  const tree = render(
    <NudgeActionButton
      {...props}
      label="Nudge"
      targetCount={1}
      onPress={jest.fn()}
    />,
  );
  const button = tree.root.findByType(Pressable);
  expect(button.props.accessibilityLabel).toBe(label);
  expect(button.props.accessibilityState).toEqual({busy, disabled: true});
  expect(button.props.disabled).toBe(true);
  expect(button.props.onPress).toBeUndefined();
});
