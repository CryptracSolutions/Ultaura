'use server';

// Ultaura Server Actions
// Server-side actions for managing Ultaura accounts, lines, and schedules

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import type {
  Line,
  Schedule,
  UsageSummary,
  LineActivity,
  CreateLineInput,
  UpdateLineInput,
  CreateScheduleInput,
  UpdateScheduleInput,
  UltauraAccountRow,
  LineRow,
  ScheduleRow,
} from './types';

const logger = getLogger();

// ============================================
// ACCOUNT ACTIONS
// ============================================

// Get or create Ultaura account for an organization
export async function getOrCreateUltauraAccount(
  organizationId: number,
  userId: string,
  name: string,
  email: string
): Promise<{ accountId: string; isNew: boolean }> {
  const client = getSupabaseServerComponentClient();

  // Check for existing account
  const { data: existing } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('organization_id', organizationId)
    .single();

  if (existing) {
    return { accountId: existing.id, isNew: false };
  }

  // Create new account
  const { data: account, error } = await client
    .from('ultaura_accounts')
    .insert({
      organization_id: organizationId,
      name,
      billing_email: email,
      created_by_user_id: userId,
      status: 'trial',
      plan_id: 'free_trial',
      minutes_included: 20,
      cycle_start: new Date().toISOString(),
      cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create Ultaura account');
    throw new Error('Failed to create account');
  }

  return { accountId: account.id, isNew: true };
}

// Get Ultaura account for organization
export async function getUltauraAccount(organizationId: number): Promise<UltauraAccountRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error({ error }, 'Failed to get Ultaura account');
    }
    return null;
  }

  return data;
}

// ============================================
// LINE ACTIONS
// ============================================

// Get all lines for an account
export async function getLines(accountId: string): Promise<LineRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get lines');
    throw new Error('Failed to get lines');
  }

  return data || [];
}

// Get a single line
export async function getLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('id', lineId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get line');
    return null;
  }

  return data;
}

// Create a new line
export async function createLine(input: CreateLineInput): Promise<{ success: boolean; lineId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Check line limit
  const account = await getUltauraAccountById(input.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const existingLines = await getLines(input.accountId);
  const plan = await getPlan(account.plan_id);

  if (existingLines.length >= (plan?.lines_included || 1)) {
    return { success: false, error: 'Line limit reached for your plan' };
  }

  // Check if phone number already exists
  const { data: existingPhone } = await client
    .from('ultaura_lines')
    .select('id')
    .eq('phone_e164', input.phoneE164)
    .single();

  if (existingPhone) {
    return { success: false, error: 'This phone number is already registered' };
  }

  // Create the line
  const { data: line, error } = await client
    .from('ultaura_lines')
    .insert({
      account_id: input.accountId,
      display_name: input.displayName,
      phone_e164: input.phoneE164,
      preferred_language: input.preferredLanguage || 'auto',
      spanish_formality: input.spanishFormality || 'usted',
      timezone: input.timezone || 'America/Los_Angeles',
      status: 'paused', // Paused until verified
      seed_interests: input.seedInterests || null,
      seed_avoid_topics: input.seedAvoidTopics || null,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create line');
    return { success: false, error: 'Failed to create line' };
  }

  revalidatePath('/dashboard/[organization]/lines', 'page');

  return { success: true, lineId: line.id };
}

// Update a line
export async function updateLine(
  lineId: string,
  input: UpdateLineInput
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const updates: Record<string, unknown> = {};

  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.preferredLanguage !== undefined) updates.preferred_language = input.preferredLanguage;
  if (input.spanishFormality !== undefined) updates.spanish_formality = input.spanishFormality;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.quietHoursStart !== undefined) updates.quiet_hours_start = input.quietHoursStart;
  if (input.quietHoursEnd !== undefined) updates.quiet_hours_end = input.quietHoursEnd;
  if (input.doNotCall !== undefined) updates.do_not_call = input.doNotCall;
  if (input.inboundAllowed !== undefined) updates.inbound_allowed = input.inboundAllowed;
  if (input.seedInterests !== undefined) updates.seed_interests = input.seedInterests;
  if (input.seedAvoidTopics !== undefined) updates.seed_avoid_topics = input.seedAvoidTopics;

  const { error } = await client
    .from('ultaura_lines')
    .update(updates)
    .eq('id', lineId);

  if (error) {
    logger.error({ error }, 'Failed to update line');
    return { success: false, error: 'Failed to update line' };
  }

  revalidatePath('/dashboard/[organization]/lines', 'page');

  return { success: true };
}

// Delete a line
export async function deleteLine(lineId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_lines')
    .delete()
    .eq('id', lineId);

  if (error) {
    logger.error({ error }, 'Failed to delete line');
    return { success: false, error: 'Failed to delete line' };
  }

  revalidatePath('/dashboard/[organization]/lines', 'page');

  return { success: true };
}

// ============================================
// PHONE VERIFICATION ACTIONS
// ============================================

// Start phone verification
export async function startPhoneVerification(
  lineId: string,
  channel: 'sms' | 'call'
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get the line
  const line = await getLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  // Call the telephony backend to send verification
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${telephonyUrl}/verify/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId,
        phoneNumber: line.phone_e164,
        channel,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to send verification' };
    }

    // Create verification record
    await client.from('ultaura_phone_verifications').insert({
      line_id: lineId,
      channel,
      status: 'pending',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Failed to start verification');
    return { success: false, error: 'Failed to send verification code' };
  }
}

// Check phone verification
export async function checkPhoneVerification(
  lineId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get the line
  const line = await getLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  // Call the telephony backend to check verification
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${telephonyUrl}/verify/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        phoneNumber: line.phone_e164,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Verification failed' };
    }

    const result = await response.json();

    if (result.verified) {
      // Update line status
      await client
        .from('ultaura_lines')
        .update({
          phone_verified_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', lineId);

      // Update verification record
      await client
        .from('ultaura_phone_verifications')
        .update({ status: 'approved' })
        .eq('line_id', lineId)
        .eq('status', 'pending');

      revalidatePath('/dashboard/[organization]/lines', 'page');

      return { success: true };
    } else {
      return { success: false, error: 'Invalid verification code' };
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check verification');
    return { success: false, error: 'Verification check failed' };
  }
}

// ============================================
// SCHEDULE ACTIONS
// ============================================

// Get schedules for a line
export async function getSchedules(lineId: string): Promise<ScheduleRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get schedules');
    return [];
  }

  return data || [];
}

// Create a schedule
export async function createSchedule(
  accountId: string,
  input: CreateScheduleInput
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Build RRULE
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const rruleDays = input.daysOfWeek.map(d => dayNames[d]).join(',');
  const rrule = `FREQ=WEEKLY;BYDAY=${rruleDays}`;

  // Calculate next run
  const [hours, minutes] = input.timeOfDay.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  while (!input.daysOfWeek.includes(next.getDay())) {
    next.setDate(next.getDate() + 1);
  }

  const { data: schedule, error } = await client
    .from('ultaura_schedules')
    .insert({
      account_id: accountId,
      line_id: input.lineId,
      enabled: true,
      timezone: input.timezone,
      rrule,
      days_of_week: input.daysOfWeek,
      time_of_day: input.timeOfDay,
      next_run_at: next.toISOString(),
      retry_policy: input.retryPolicy || { max_retries: 2, retry_window_minutes: 30 },
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create schedule');
    return { success: false, error: 'Failed to create schedule' };
  }

  // Update line's next scheduled call
  await client
    .from('ultaura_lines')
    .update({ next_scheduled_call_at: next.toISOString() })
    .eq('id', input.lineId);

  // Record consent for outbound calls
  await client.from('ultaura_consents').insert({
    account_id: accountId,
    line_id: input.lineId,
    type: 'outbound_calls',
    granted: true,
    granted_by: 'payer_ack',
    evidence: { timestamp: new Date().toISOString() },
  });

  revalidatePath('/dashboard/[organization]/lines', 'page');
  revalidatePath('/dashboard/[organization]/schedules', 'page');

  return { success: true, scheduleId: schedule.id };
}

// Update a schedule
export async function updateSchedule(
  scheduleId: string,
  input: UpdateScheduleInput
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const updates: Record<string, unknown> = {};

  if (input.enabled !== undefined) updates.enabled = input.enabled;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.daysOfWeek !== undefined) {
    updates.days_of_week = input.daysOfWeek;
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    updates.rrule = `FREQ=WEEKLY;BYDAY=${input.daysOfWeek.map(d => dayNames[d]).join(',')}`;
  }
  if (input.timeOfDay !== undefined) updates.time_of_day = input.timeOfDay;
  if (input.retryPolicy !== undefined) updates.retry_policy = input.retryPolicy;

  // Recalculate next run if schedule changed
  if (input.daysOfWeek || input.timeOfDay) {
    const { data: current } = await client
      .from('ultaura_schedules')
      .select('days_of_week, time_of_day')
      .eq('id', scheduleId)
      .single();

    const daysOfWeek = input.daysOfWeek || current?.days_of_week || [];
    const timeOfDay = input.timeOfDay || current?.time_of_day || '18:00';

    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    while (!daysOfWeek.includes(next.getDay())) {
      next.setDate(next.getDate() + 1);
    }

    updates.next_run_at = next.toISOString();
  }

  const { error } = await client
    .from('ultaura_schedules')
    .update(updates)
    .eq('id', scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to update schedule');
    return { success: false, error: 'Failed to update schedule' };
  }

  revalidatePath('/dashboard/[organization]/schedules', 'page');

  return { success: true };
}

// Delete a schedule
export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to delete schedule');
    return { success: false, error: 'Failed to delete schedule' };
  }

  revalidatePath('/dashboard/[organization]/schedules', 'page');

  return { success: true };
}

// ============================================
// USAGE ACTIONS
// ============================================

// Get usage summary for an account
export async function getUsageSummary(accountId: string): Promise<UsageSummary | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client.rpc('get_ultaura_usage_summary', {
    p_account_id: accountId,
  });

  if (error) {
    logger.error({ error }, 'Failed to get usage summary');
    return null;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    minutesIncluded: row.minutes_included,
    minutesUsed: row.minutes_used,
    minutesRemaining: row.minutes_remaining,
    overageMinutes: row.overage_minutes,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
  };
}

// Get line activity
export async function getLineActivity(accountId: string): Promise<LineActivity[]> {
  const client = getSupabaseServerComponentClient();

  const { data: lines } = await client
    .from('ultaura_lines')
    .select('id, display_name, last_successful_call_at, next_scheduled_call_at')
    .eq('account_id', accountId);

  if (!lines) return [];

  const activities: LineActivity[] = [];

  for (const line of lines) {
    // Get last call duration
    let lastCallDuration: number | null = null;
    if (line.last_successful_call_at) {
      const { data: lastCall } = await client
        .from('ultaura_call_sessions')
        .select('seconds_connected')
        .eq('line_id', line.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      lastCallDuration = lastCall?.seconds_connected || null;
    }

    activities.push({
      lineId: line.id,
      displayName: line.display_name,
      lastCallAt: line.last_successful_call_at,
      lastCallDuration,
      nextScheduledAt: line.next_scheduled_call_at,
    });
  }

  return activities;
}

// ============================================
// TEST CALL ACTION
// ============================================

// Initiate a test call
export async function initiateTestCall(lineId: string): Promise<{ success: boolean; error?: string }> {
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${telephonyUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId,
        reason: 'test',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to initiate test call' };
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Failed to initiate test call');
    return { success: false, error: 'Failed to initiate test call' };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUltauraAccountById(accountId: string): Promise<UltauraAccountRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) return null;
  return data;
}

async function getPlan(planId: string) {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// CHECKOUT ACTIONS
// ============================================

// Ultaura plan to Stripe price ID mapping
const ULTAURA_PRICE_IDS: Record<string, { monthly?: string; annual?: string }> = {
  care: {
    monthly: process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID,
  },
  comfort: {
    monthly: process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID,
  },
  family: {
    monthly: process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID,
  },
  payg: {
    monthly: process.env.STRIPE_ULTAURA_PAYG_PRICE_ID,
  },
};

// Create a Stripe checkout session for an Ultaura plan
export async function createUltauraCheckout(
  planId: string,
  billingInterval: 'monthly' | 'annual',
  organizationUid: string,
  returnUrl: string
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  // Validate plan
  if (!['care', 'comfort', 'family', 'payg'].includes(planId)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  // Get the price ID
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  const priceId = billingInterval === 'annual' && priceConfig?.annual
    ? priceConfig.annual
    : priceConfig?.monthly;

  if (!priceId) {
    logger.error({ planId, billingInterval }, 'Missing Stripe price ID for Ultaura plan');
    return { success: false, error: 'Pricing configuration error. Please contact support.' };
  }

  try {
    // Import Stripe utilities
    const getStripeInstance = (await import('~/core/stripe/get-stripe')).default;
    const stripe = await getStripeInstance();

    // Get organization's Stripe customer ID if exists
    const client = getSupabaseServerComponentClient();
    const { data: org } = await client
      .from('organizations')
      .select('subscription_id')
      .eq('uuid', organizationUid)
      .single();

    let customerId: string | undefined;
    if (org?.subscription_id) {
      const { data: sub } = await client
        .from('subscriptions')
        .select('customer_id')
        .eq('id', org.subscription_id)
        .single();
      customerId = sub?.customer_id;
    }

    // Determine trial period (7 days for new customers)
    const trialPeriodDays = customerId ? undefined : 7;

    // Create checkout session
    const successUrl = `${returnUrl}?success=true&plan=${planId}`;
    const cancelUrl = `${returnUrl}?canceled=true`;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationUid,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        trial_period_days: trialPeriodDays,
        metadata: {
          organizationUid,
          ultauraPlanId: planId,
        },
      },
      metadata: {
        ultauraPlanId: planId,
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return { success: false, error: 'Failed to create checkout session' };
    }

    return { success: true, checkoutUrl: session.url };

  } catch (error) {
    logger.error({ error, planId }, 'Failed to create Ultaura checkout session');
    return { success: false, error: 'Failed to create checkout session' };
  }
}

// Get the appropriate price ID for a plan
export async function getUltauraPriceId(
  planId: string,
  billingInterval: 'monthly' | 'annual'
): Promise<string | null> {
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  if (!priceConfig) return null;

  if (billingInterval === 'annual' && priceConfig.annual) {
    return priceConfig.annual;
  }
  return priceConfig.monthly || null;
}
