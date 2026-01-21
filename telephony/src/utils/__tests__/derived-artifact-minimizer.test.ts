import { describe, expect, it } from 'vitest';
import { minimizeDerivedObjectDeep, minimizeDerivedText } from '../derived-artifact-minimizer.js';

describe('derived-artifact minimizer', () => {
  it('minimizes sentence fields (no quotes/newlines/speaker labels, first sentence, <=200 chars)', () => {
    const input = `User: "Hello there."\nSecond sentence follows. Third sentence.\n`;
    const output = minimizeDerivedText(input, 'sentence');

    expect(output).not.toContain('\n');
    expect(output).not.toContain('\r');
    expect(output).not.toContain('"');
    expect(output.toLowerCase()).not.toContain('user:');
    expect(output).toBe('Hello there.');
    expect(output.length).toBeLessThanOrEqual(200);
  });

  it('minimizes label fields (no quotes/newlines/speaker labels, no sentence truncation)', () => {
    const input = `Assistant: "Bob's Burgers" - NYC.\n`;
    const output = minimizeDerivedText(input, 'label');

    expect(output).toBe(`Bob's Burgers - NYC.`);
    expect(output).not.toContain('\n');
    expect(output).not.toContain('"');
    expect(output.toLowerCase()).not.toContain('assistant:');
    expect(output.length).toBeLessThanOrEqual(200);
  });

  it('recursively minimizes strings in objects using key hints', () => {
    const input = {
      title: `User: "My Story".`,
      description: `User: "First sentence." Second sentence.`,
      nested: {
        location: `Assistant: "New York"\n`,
      },
    };

    const output = minimizeDerivedObjectDeep(input);

    expect(output.title).toBe('My Story.');
    expect(output.description).toBe('First sentence.');
    expect(output.nested.location).toBe('New York');
  });
});

