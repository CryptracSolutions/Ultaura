import { describe, it, expect } from 'vitest';
import { sanitizePayload } from '../event-sanitizer.js';

describe('sanitizePayload', () => {
  describe('tool_call events', () => {
    it('should strip memory values from update_memory', () => {
      const payload = {
        tool: 'update_memory',
        key: 'favorite_food',
        previousValue: 'pizza',
        newValue: 'pasta',
        action: 'updated',
        success: true,
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'update_memory',
        key: 'favorite_food',
        action: 'updated',
        success: true,
      });
      expect(stripped).toEqual({
        previousValue: 'pizza',
        newValue: 'pasta',
      });
    });

    it('should strip reminder message and due date from set_reminder', () => {
      const payload = {
        tool: 'set_reminder',
        reminderId: 'uuid-123',
        message: 'Take medication at 9am',
        dueAt: '2024-01-15T09:00:00Z',
        isRecurring: true,
        success: true,
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'set_reminder',
        reminderId: 'uuid-123',
        success: true,
      });
      expect(stripped).toEqual({
        message: 'Take medication at 9am',
        dueAt: '2024-01-15T09:00:00Z',
        isRecurring: true,
      });
    });

    it('should keep only metadata for log_call_insights', () => {
      const payload = {
        tool: 'log_call_insights',
        success: true,
        has_concerns: true,
        confidence_overall: 0.7,
        engagement_score: 5,
        topics: [{ code: 'family', weight: 1 }],
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'log_call_insights',
        success: true,
        has_concerns: true,
        confidence_overall: 0.7,
      });
      expect(stripped).toEqual({
        engagement_score: 5,
        topics: [{ code: 'family', weight: 1 }],
      });
    });

    it('should handle unknown tools with default allowlist', () => {
      const payload = {
        tool: 'unknown_future_tool',
        success: true,
        errorCode: 'E_UNKNOWN',
        sensitiveData: 'should be stripped',
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'unknown_future_tool',
        success: true,
        errorCode: 'E_UNKNOWN',
      });
      expect(stripped).toEqual({
        sensitiveData: 'should be stripped',
      });
    });

    it('should normalize tool aliases to canonical names', () => {
      const payload = {
        tool: 'overage_action',
        action: 'upgrade',
        planId: 'care',
        success: true,
      };

      const { sanitized } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'choose_overage_action',
        action: 'upgrade',
        planId: 'care',
        success: true,
      });
    });
  });

  describe('state_change events', () => {
    it('should keep only allowed state_change fields', () => {
      const payload = {
        event: 'opt_out',
        source: 'voice',
        sensitiveData: 'should be stripped',
      };

      const { sanitized, stripped } = sanitizePayload('state_change', payload);

      expect(sanitized).toEqual({
        event: 'opt_out',
        source: 'voice',
      });
      expect(stripped).toEqual({
        sensitiveData: 'should be stripped',
      });
    });
  });

  describe('safety_tier events', () => {
    it('should keep only tier and actionTaken', () => {
      const payload = {
        tier: 'high',
        actionTaken: 'suggested_911',
        signals: 'User mentioned self-harm',
      };

      const { sanitized, stripped } = sanitizePayload('safety_tier', payload);

      expect(sanitized).toEqual({
        tier: 'high',
        actionTaken: 'suggested_911',
      });
      expect(stripped).toEqual({
        signals: 'User mentioned self-harm',
      });
    });
  });

  describe('error events', () => {
    it('should keep only errorType and errorCode, strip messages', () => {
      const payload = {
        errorType: 'grok_connection_failed',
        errorCode: 'WS_CLOSE_1006',
        errorMessage: 'Connection closed unexpectedly with user data...',
        stack: 'Error: at line 123...',
      };

      const { sanitized, stripped } = sanitizePayload('error', payload);

      expect(sanitized).toEqual({
        errorType: 'grok_connection_failed',
        errorCode: 'WS_CLOSE_1006',
      });
      expect(stripped).toEqual({
        errorMessage: 'Connection closed unexpectedly with user data...',
        stack: 'Error: at line 123...',
      });
    });
  });
});
