import {getComposerQuantity} from '../src/features/check-in/components/composer-quantity';
import type {CircleDetailModel} from '../src/types/models';
const circle = {
  commitmentType: 'build',
  targetValue: 30,
  unitLabel: 'pages',
} as CircleDetailModel;
it.each([
  [0, '30 pages to go', 0],
  [20, '10 pages to go', 2 / 3],
  [30, 'Goal covered', 1],
  [40, 'Goal covered', 1],
])('describes Build %s with a bounded arc', (value, status, progress) => {
  expect(getComposerQuantity(circle, value as number)).toMatchObject({
    status,
    progress,
    goal: 'Goal: 30 pages',
  });
});
it.each([
  [0, 'Within limit'],
  [3, 'Within limit'],
  [4, 'Above limit'],
])('keeps maximum Limit %s unfilled', (value, status) => {
  expect(
    getComposerQuantity(
      {...circle, commitmentType: 'limit', maximumValue: 3, unitLabel: 'cups'},
      value as number,
    ),
  ).toMatchObject({status, progress: 0, goal: 'Daily maximum: 3 cups'});
});
it.each([
  [0, 'Below range'],
  [1, 'Below range'],
  [2, 'Within range'],
  [3, 'Within range'],
  [4, 'Above range'],
])('states range compliance at %s', (value, status) => {
  expect(
    getComposerQuantity(
      {
        ...circle,
        commitmentType: 'limit',
        minimumValue: 2,
        maximumValue: 3,
        unitLabel: 'cups',
      },
      value as number,
    ),
  ).toMatchObject({status, progress: 0, goal: 'Allowed range: 2 to 3 cups'});
});
