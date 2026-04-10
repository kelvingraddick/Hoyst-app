import {brandColors} from '../src/design/tokens/colors';
import {gradients} from '../src/design/tokens/gradients';

describe('Hoyst design tokens', () => {
  it('keeps the orange CTA token stable', () => {
    expect(brandColors.orange).toBe('#FF8A3D');
  });

  it('defines a four-stop primary ring gradient', () => {
    expect(gradients.primaryRing).toHaveLength(4);
  });
});
