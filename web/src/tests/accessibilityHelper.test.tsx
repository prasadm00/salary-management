import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { findAccessibilityProblems } from './testUtils';

// The accessibility tests on every page only mean something if the checker can really fail.
describe('findAccessibilityProblems', () => {
  it('reports an input with no label and an image with no description', async () => {
    render(
      <div>
        <input type="text" />
        <img src="chart.png" />
      </div>,
    );

    const problems = await findAccessibilityProblems();

    expect(problems.join(' ')).toContain('label');
    expect(problems.join(' ')).toContain('image-alt');
  });

  it('reports nothing for markup that is fine', async () => {
    render(
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" type="text" />
      </div>,
    );

    expect(await findAccessibilityProblems()).toEqual([]);
  });
});
