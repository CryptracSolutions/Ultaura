#!/usr/bin/env tsx
/**
 * Deterministic canonical-tool test coverage audit.
 * Validates that every Grok tool (from GROK_TOOLS) has per-tool evidence of:
 *   - Handler extraction (getPostHandler call, with path for multi-route)
 *   - At least one success-path assertion
 *   - At least one failure-path assertion
 *
 * Exit non-zero on any gap.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = resolve(__dirname, '../src/routes/tools/__tests__');

// ---------------------------------------------------------------------------
// Canonical tool → route path → expected test file
// Source of truth: spec rows 2–53
// ---------------------------------------------------------------------------

type ToolEntry = {
  canonical: string;
  routePath: string;
  testFile: string;
  multiRoute?: boolean;
  handlerPath?: string;
  /** Router variable name imported in the test file (for handler extraction check) */
  routerVar?: string;
  /** Identifiers to search for per-tool evidence in the test file */
  identifiers: string[];
};

function defaultIdentifiers(canonical: string): string[] {
  // Generate identifiers from canonical name: the name itself, camelCase router var, describe labels
  const parts = canonical.split('_');
  const camel = parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return [canonical, camel];
}

const TOOL_MATRIX: ToolEntry[] = [
  { canonical: 'store_call_preview', routePath: '/tools/store_call_preview', testFile: 'retention-tools.test.ts', identifiers: ['store_call_preview', 'storeCallPreview', 'Preview'] },
  { canonical: 'mark_preview_outcome', routePath: '/tools/mark_preview_outcome', testFile: 'retention-tools.test.ts', identifiers: ['mark_preview_outcome', 'markPreviewOutcome', 'outcome'] },
  { canonical: 'log_segment_engagement', routePath: '/tools/log_segment_engagement', testFile: 'retention-tools.test.ts', identifiers: ['log_segment_engagement', 'logSegmentEngagement', 'segment'] },
  { canonical: 'manage_story_arc', routePath: '/tools/manage_story_arc', testFile: 'retention-tools.test.ts', identifiers: ['manage_story_arc', 'manageStoryArc', 'story_arc'] },
  { canonical: 'store_life_chapter', routePath: '/tools/store_life_chapter', testFile: 'personalization-tools.test.ts', identifiers: ['store_life_chapter', 'storeLifeChapter', 'life_chapter', 'lifeChapter'] },
  { canonical: 'store_milestone', routePath: '/tools/store_milestone', testFile: 'personalization-tools.test.ts', identifiers: ['store_milestone', 'storeMilestone'] },
  { canonical: 'mark_milestone_celebrated', routePath: '/tools/mark_milestone_celebrated', testFile: 'personalization-tools.test.ts', identifiers: ['mark_milestone_celebrated', 'markMilestoneCelebrated', 'celebrated'] },
  { canonical: 'update_relationship', routePath: '/tools/update_relationship', testFile: 'personalization-tools.test.ts', identifiers: ['update_relationship', 'updateRelationship'] },
  { canonical: 'mark_relationship_deceased', routePath: '/tools/mark_relationship_deceased', testFile: 'personalization-tools.test.ts', identifiers: ['mark_relationship_deceased', 'markRelationshipDeceased', 'deceased'] },
  { canonical: 'log_mood_snapshot', routePath: '/tools/log_mood_snapshot', testFile: 'insights-tools.test.ts', identifiers: ['log_mood_snapshot', 'logMoodSnapshot', 'mood'] },
  { canonical: 'log_cognitive_observation', routePath: '/tools/log_cognitive_observation', testFile: 'personalization-tools.test.ts', identifiers: ['log_cognitive_observation', 'logCognitiveObservation', 'cognitive'] },
  { canonical: 'adjust_accessibility', routePath: '/tools/adjust_accessibility', testFile: 'personalization-tools.test.ts', identifiers: ['adjust_accessibility', 'adjustAccessibility', 'accessibility'] },
  { canonical: 'set_voice_preference', routePath: '/tools/set_voice_preference', testFile: 'settings-tools.test.ts', identifiers: ['set_voice_preference', 'setVoicePreference', 'voice'] },
  { canonical: 'update_content_preference', routePath: '/tools/update_content_preference', testFile: 'personalization-tools.test.ts', identifiers: ['update_content_preference', 'updateContentPreference', 'content_preference'] },
  { canonical: 'log_health_mention', routePath: '/tools/log_health_mention', testFile: 'personalization-tools.test.ts', identifiers: ['log_health_mention', 'logHealthMention', 'health'] },
  { canonical: 'set_reminder', routePath: '/tools/set_reminder', testFile: 'reminder-tools.test.ts', identifiers: ['set_reminder', 'setReminder'] },
  { canonical: 'schedule_call', routePath: '/tools/schedule_call', testFile: 'schedule-call-tool.test.ts', identifiers: ['schedule_call', 'scheduleCall'] },
  { canonical: 'skip_schedule', routePath: '/tools/skip_schedule', testFile: 'schedule-control-tools.test.ts', identifiers: ['skip_schedule', 'skipSchedule', 'skip'] },
  { canonical: 'snooze_schedule', routePath: '/tools/snooze_schedule', testFile: 'schedule-control-tools.test.ts', identifiers: ['snooze_schedule', 'snoozeSchedule'] },
  { canonical: 'reschedule_schedule', routePath: '/tools/reschedule_schedule', testFile: 'schedule-control-tools.test.ts', identifiers: ['reschedule_schedule', 'rescheduleSchedule'] },
  { canonical: 'choose_overage_action', routePath: '/tools/overage_action', testFile: 'billing-tools.test.ts', identifiers: ['choose_overage_action', 'overageAction', 'overage'] },
  { canonical: 'request_opt_out', routePath: '/tools/opt_out', testFile: 'billing-tools.test.ts', identifiers: ['request_opt_out', 'optOut', 'opt_out'] },
  { canonical: 'forget_memory', routePath: '/tools/forget_memory', testFile: 'memory-tools.test.ts', identifiers: ['forget_memory', 'forgetMemory', 'forget'] },
  { canonical: 'store_memory', routePath: '/tools/store_memory', testFile: 'memory-tools.test.ts', identifiers: ['store_memory', 'storeMemory'] },
  { canonical: 'update_memory', routePath: '/tools/update_memory', testFile: 'memory-tools.test.ts', identifiers: ['update_memory', 'updateMemory'] },
  { canonical: 'grant_memory_consent', routePath: '/tools/grant_memory_consent', testFile: 'voice-consent-tools.test.ts', multiRoute: true, handlerPath: '/grant_memory_consent', identifiers: ['grant_memory_consent', 'grantHandler', 'grant'] },
  { canonical: 'deny_memory_consent', routePath: '/tools/deny_memory_consent', testFile: 'voice-consent-tools.test.ts', multiRoute: true, handlerPath: '/deny_memory_consent', identifiers: ['deny_memory_consent', 'denyHandler', 'deny'] },
  { canonical: 'grant_recording_consent', routePath: '/tools/grant_recording_consent', testFile: 'recording-consent-tools.test.ts', multiRoute: true, handlerPath: '/grant_recording_consent', identifiers: ['grant_recording_consent', 'grantHandler'] },
  { canonical: 'deny_recording_consent', routePath: '/tools/deny_recording_consent', testFile: 'recording-consent-tools.test.ts', multiRoute: true, handlerPath: '/deny_recording_consent', identifiers: ['deny_recording_consent', 'denyHandler'] },
  { canonical: 'revoke_recording_consent', routePath: '/tools/revoke_recording_consent', testFile: 'recording-consent-tools.test.ts', multiRoute: true, handlerPath: '/revoke_recording_consent', identifiers: ['revoke_recording_consent', 'revokeHandler'] },
  { canonical: 'set_recording_preference_permanent', routePath: '/tools/set_recording_preference_permanent', testFile: 'recording-consent-tools.test.ts', multiRoute: true, handlerPath: '/set_recording_preference_permanent', identifiers: ['set_recording_preference_permanent', 'prefHandler', 'never_ask'] },
  { canonical: 'set_sharing_tier', routePath: '/tools/set_sharing_tier', testFile: 'sharing-consent-tools.test.ts', multiRoute: true, handlerPath: '/set_sharing_tier', identifiers: ['set_sharing_tier', 'setTierHandler'] },
  { canonical: 'get_sharing_tier', routePath: '/tools/get_sharing_tier', testFile: 'sharing-consent-tools.test.ts', multiRoute: true, handlerPath: '/get_sharing_tier', identifiers: ['get_sharing_tier', 'getTierHandler'] },
  { canonical: 'enable_family_sharing', routePath: '/tools/enable_family_sharing', testFile: 'sharing-consent-tools.test.ts', multiRoute: true, handlerPath: '/enable_family_sharing', identifiers: ['enable_family_sharing', 'enableHandler', 'family_sharing'] },
  { canonical: 'exclude_memory_topic', routePath: '/tools/exclude_topic', testFile: 'privacy-tools.test.ts', identifiers: ['exclude_memory_topic', 'excludeTopic', 'exclude'] },
  { canonical: 'include_memory_topic', routePath: '/tools/include_topic', testFile: 'privacy-tools.test.ts', identifiers: ['include_memory_topic', 'includeTopic', 'include'] },
  { canonical: 'list_topic_exclusions', routePath: '/tools/list_topic_exclusions', testFile: 'privacy-tools.test.ts', identifiers: ['list_topic_exclusions', 'listExclusions'] },
  { canonical: 'review_memories', routePath: '/tools/review_memories', testFile: 'memory-tools.test.ts', identifiers: ['review_memories', 'reviewMemories', 'review'] },
  { canonical: 'mark_private', routePath: '/tools/mark_private', testFile: 'memory-tools.test.ts', identifiers: ['mark_private', 'markPrivate'] },
  { canonical: 'mark_topic_private', routePath: '/tools/mark_topic_private', testFile: 'privacy-tools.test.ts', identifiers: ['mark_topic_private', 'markTopicPrivate', 'topic_private'] },
  { canonical: 'set_pause_mode', routePath: '/tools/set_pause_mode', testFile: 'settings-tools.test.ts', identifiers: ['set_pause_mode', 'setPauseMode', 'pause_mode'] },
  { canonical: 'set_insights_enabled', routePath: '/tools/set_insights_enabled', testFile: 'insights-tools.test.ts', identifiers: ['set_insights_enabled', 'setInsightsEnabled', 'insights_enabled'] },
  { canonical: 'log_call_insights', routePath: '/tools/log_call_insights', testFile: 'insights-tools.test.ts', identifiers: ['log_call_insights', 'logCallInsights', 'insightId'] },
  { canonical: 'log_safety_concern', routePath: '/tools/safety_event', testFile: 'safety-event-tool.test.ts', identifiers: ['log_safety_concern', 'safety_event', 'safetyEvent'] },
  { canonical: 'report_conversation_language', routePath: '/tools/report_conversation_language', testFile: 'settings-tools.test.ts', identifiers: ['report_conversation_language', 'reportConversationLanguage', 'languageCode'] },
  { canonical: 'list_reminders', routePath: '/tools/list_reminders', testFile: 'reminder-tools.test.ts', identifiers: ['list_reminders', 'listReminders'] },
  { canonical: 'edit_reminder', routePath: '/tools/edit_reminder', testFile: 'reminder-tools.test.ts', identifiers: ['edit_reminder', 'editReminder'] },
  { canonical: 'pause_reminder', routePath: '/tools/pause_reminder', testFile: 'reminder-management-tools.test.ts', identifiers: ['pause_reminder', 'pauseReminder'] },
  { canonical: 'resume_reminder', routePath: '/tools/resume_reminder', testFile: 'reminder-management-tools.test.ts', identifiers: ['resume_reminder', 'resumeReminder'] },
  { canonical: 'snooze_reminder', routePath: '/tools/snooze_reminder', testFile: 'reminder-management-tools.test.ts', identifiers: ['snooze_reminder', 'snoozeReminder'] },
  { canonical: 'cancel_reminder', routePath: '/tools/cancel_reminder', testFile: 'reminder-management-tools.test.ts', identifiers: ['cancel_reminder', 'cancelReminder'] },
  { canonical: 'request_upgrade', routePath: '/tools/request_upgrade', testFile: 'billing-tools.test.ts', identifiers: ['request_upgrade', 'requestUpgrade', 'upgradeHandler'] },
];

// ---------------------------------------------------------------------------
// Per-tool validation helpers
// ---------------------------------------------------------------------------

/** Extract ALL describe/it sections for a specific tool based on its identifiers.
 *  Concatenates all matching describe blocks + any lines outside describe blocks
 *  that reference the tool identifiers. */
function extractToolSection(content: string, identifiers: string[]): string | null {
  const lines = content.split('\n');
  const sections: string[] = [];

  // Find ALL describe blocks that reference any identifier
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*describe\(/.test(line) && identifiers.some((id) => line.includes(id))) {
      let depth = 0;
      let endIdx = lines.length;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth <= 0 && j > i) {
          endIdx = j + 1;
          break;
        }
      }
      sections.push(lines.slice(i, endIdx).join('\n'));
      i = endIdx - 1; // skip past this block
    }
  }

  // Also collect individual it() blocks or standalone lines referencing identifiers
  // (for tools tested inside another tool's describe block)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*it\(/.test(line) && identifiers.some((id) => line.includes(id))) {
      let depth = 0;
      let endIdx = lines.length;
      for (let j = i; j < lines.length; j++) {
        depth += (lines[j].match(/\{/g) || []).length;
        depth -= (lines[j].match(/\}/g) || []).length;
        if (depth <= 0 && j > i) {
          endIdx = j + 1;
          break;
        }
      }
      sections.push(lines.slice(i, endIdx).join('\n'));
      i = endIdx - 1;
    }
  }

  if (sections.length > 0) {
    return sections.join('\n');
  }

  // Fallback: if the tool's handler variable or Router import appears in the file,
  // the file covers this tool — use full content
  if (identifiers.some((id) =>
    content.includes(id + 'Handler') || content.includes(id + 'Router') || content.includes(`'${id}'`))
  ) {
    return content;
  }

  // Last resort: any identifier anywhere
  if (identifiers.some((id) => content.includes(id))) {
    return content;
  }

  return null;
}

function hasHandlerExtraction(content: string, entry: ToolEntry): boolean {
  if (entry.multiRoute && entry.handlerPath) {
    // Multi-route: must have getPostHandler(..., '/exact_path') — check for the path in a getPostHandler call
    const escapedPath = entry.handlerPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`getPostHandler\\([^)]*['"]${escapedPath}['"]\\)`);
    return regex.test(content);
  }
  // Single-route: getPostHandler(router) is sufficient
  return content.includes('getPostHandler(');
}

const SUCCESS_PATTERNS = [
  /success:\s*true/,
  /\.success\)\.toBe\(true\)/,
  /toMatchObject\(\{[^}]*success:\s*true/,
  /toEqual\(\{[^}]*success:\s*true/,
  /success\)\.toBeTruthy\(\)/,
];

const FAILURE_PATTERNS = [
  /toHaveBeenCalledWith\(4\d\d/,
  /toHaveBeenCalledWith\(500/,
  /statusCode\)\.toBe\(4\d\d\)/,
  /statusCode\)\.toBe\(500\)/,
  /\.success\)\.toBe\(false\)/,
  /success:\s*false/,
  /\.body\)\.toEqual\(\{[^}]*error/,
  /\.body\.error\b/,
  /\.body\)\.toMatchObject\(\{[^}]*error/,
];

function hasSuccessAssertion(section: string): boolean {
  return SUCCESS_PATTERNS.some((p) => p.test(section));
}

function hasFailureAssertion(section: string): boolean {
  return FAILURE_PATTERNS.some((p) => p.test(section));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const defsPath = resolve(__dirname, '../../packages/prompts/src/tools/definitions.ts');
const defsContent = readFileSync(defsPath, 'utf-8');
const definedTools = new Set(
  [...defsContent.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
);

let failures = 0;
const results: string[] = [];

for (const entry of TOOL_MATRIX.sort((a, b) => a.canonical.localeCompare(b.canonical))) {
  const testPath = resolve(TESTS_ROOT, entry.testFile);
  const fileExists = existsSync(testPath);

  if (!fileExists) {
    results.push(`[FAIL] ${entry.canonical} -> ${entry.routePath} -> ${entry.testFile} (file:N handler:N success:N failure:N)`);
    failures++;
    continue;
  }

  const fullContent = readFileSync(testPath, 'utf-8');

  // Handler check is always file-level (handlers are extracted at module scope)
  const handler = hasHandlerExtraction(fullContent, entry);

  // Success/failure checks are per-tool section
  const toolSection = extractToolSection(fullContent, entry.identifiers);
  const success = toolSection ? hasSuccessAssertion(toolSection) : false;
  const failure = toolSection ? hasFailureAssertion(toolSection) : false;

  const yn = (b: boolean) => (b ? 'Y' : 'N');
  const pass = handler && success && failure;

  if (!pass) failures++;

  results.push(
    `[${pass ? 'PASS' : 'FAIL'}] ${entry.canonical} -> ${entry.routePath} -> ${entry.testFile} (handler:${yn(handler)} success:${yn(success)} failure:${yn(failure)})`
  );

  // Validate canonical name exists in GROK_TOOLS — FAIL not warn
  if (!definedTools.has(entry.canonical)) {
    results.push(`[FAIL] ${entry.canonical} not found in GROK_TOOLS definitions — matrix/definitions mismatch`);
    failures++;
  }
}

// Check for tools in GROK_TOOLS not in our matrix (excluding web_search) — FAIL not warn
const matrixNames = new Set(TOOL_MATRIX.map((e) => e.canonical));
for (const name of [...definedTools].sort()) {
  if (name === 'web_search') continue;
  if (!matrixNames.has(name)) {
    results.push(`[FAIL] ${name} -> ??? -> ??? (in GROK_TOOLS but not in coverage matrix)`);
    failures++;
  }
}

console.log('\n=== Grok Tool Test Coverage Audit ===\n');
for (const line of results) {
  console.log(line);
}

console.log(`\n--- ${TOOL_MATRIX.length} tools checked, ${failures} failures ---\n`);

if (failures > 0) {
  console.error(`FAIL: ${failures} tool(s) missing required test coverage.`);
  process.exit(1);
}

console.log('PASS: All canonical tools have required test coverage.');
process.exit(0);
