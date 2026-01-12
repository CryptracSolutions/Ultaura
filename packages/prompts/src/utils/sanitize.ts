export function sanitizeForPrompt(value: string): string {
  const escaped = value
    .replace(/\r?\n/g, '\\n')
    .replace(/\t/g, '\\t');

  const withoutCodeBlocks = escaped.replace(/```[\s\S]*?```/g, '');
  const withoutHeaders = withoutCodeBlocks.replace(/(^|\\n)#+\s*/g, '$1');
  const withoutBullets = withoutHeaders.replace(/(^|\\n)\s*[-*]\s+/g, '$1');
  const withoutBold = withoutBullets.replace(/\*\*/g, '');
  const withoutRules = withoutBold.replace(/(^|\\n)---(?=\\n|$)/g, '$1');

  return withoutRules.slice(0, 500);
}

export function sanitizeKey(key: string): string {
  // Normalize to strict snake_case for prompt safety and consistency.
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 50);
}
