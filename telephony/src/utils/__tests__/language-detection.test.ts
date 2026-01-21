import { describe, expect, it } from 'vitest';
import { detectLanguageFromText } from '../language-detection.js';

describe('detectLanguageFromText', () => {
  it('detects English', () => {
    const text = 'Hello, how are you doing today? It is nice to talk with you and hear about your day.';
    expect(detectLanguageFromText(text)).toBe('en');
  });

  it('detects Spanish', () => {
    const text = 'Hola, ¿cómo estás hoy? Me alegra hablar contigo y escuchar sobre tu día.';
    expect(detectLanguageFromText(text)).toBe('es');
  });

  it('detects Chinese', () => {
    const text = '你好，很高兴认识你。今天过得怎么样？我们可以聊聊你的日常生活。';
    expect(detectLanguageFromText(text)).toBe('zh');
  });
});

