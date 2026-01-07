import { createClient } from '@supabase/supabase-js';
import { beforeEach, vi } from 'vitest';
import type { LineRow, UltauraAccountRow } from '../types';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://localhost:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for unit tests');
}

process.env.ULTAURA_INTERNAL_API_SECRET ||= 'test-secret';
process.env.ULTAURA_BACKEND_URL ||= 'http://localhost:3001';

export const testServiceRoleClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('~/core/supabase/server-component-client', () => ({
  default: vi.fn(() => testServiceRoleClient),
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

let phoneCounter = 0;

function nextPhoneNumber(): string {
  phoneCounter += 1;
  const suffix = String(phoneCounter).padStart(4, '0');
  return `+1415555${suffix}`;
}

export async function createTestUser() {
  const email = `test-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = 'testpass123!';
  const { data, error } = await testServiceRoleClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(error?.message || 'Failed to create test user');
  }

  const { error: publicUserError } = await testServiceRoleClient
    .from('users')
    .insert({ id: data.user.id, onboarded: true });

  if (publicUserError) {
    throw new Error(publicUserError.message);
  }

  return { user: data.user, email, password };
}

export async function createTestOrganization(userId?: string) {
  const { data: organization, error } = await testServiceRoleClient
    .from('organizations')
    .insert({ name: `Test Org ${Date.now()}` })
    .select()
    .single();

  if (error || !organization) {
    throw new Error(error?.message || 'Failed to create test organization');
  }

  if (userId) {
    const { error: membershipError } = await testServiceRoleClient
      .from('memberships')
      .insert({ user_id: userId, organization_id: organization.id, role: 2 });

    if (membershipError) {
      throw new Error(membershipError.message);
    }
  }

  return organization;
}

export async function createTestAccount(params?: {
  planId?: string;
  status?: string;
  minutesIncluded?: number;
}) {
  const { user, email, password } = await createTestUser();
  const organization = await createTestOrganization(user.id);
  const now = new Date();
  const cycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: account, error } = await testServiceRoleClient
    .from('ultaura_accounts')
    .insert({
      organization_id: organization.id,
      name: 'Test Account',
      billing_email: email,
      status: params?.status ?? 'active',
      plan_id: params?.planId ?? 'care',
      minutes_included: params?.minutesIncluded ?? 300,
      minutes_used: 0,
      cycle_start: now.toISOString(),
      cycle_end: cycleEnd.toISOString(),
      created_by_user_id: user.id,
    })
    .select()
    .single();

  if (error || !account) {
    throw new Error(error?.message || 'Failed to create test account');
  }

  return { account: account as UltauraAccountRow, organization, user, email, password };
}

export async function createTestLine(
  accountId: string,
  overrides: Partial<LineRow> = {}
) {
  const { data: line, error } = await testServiceRoleClient
    .from('ultaura_lines')
    .insert({
      account_id: accountId,
      display_name: overrides.display_name ?? 'Test Line',
      phone_e164: overrides.phone_e164 ?? nextPhoneNumber(),
      timezone: overrides.timezone ?? 'America/Los_Angeles',
      status: overrides.status ?? 'active',
      phone_verified_at: overrides.phone_verified_at ?? new Date().toISOString(),
      quiet_hours_start: overrides.quiet_hours_start ?? '21:00',
      quiet_hours_end: overrides.quiet_hours_end ?? '09:00',
      do_not_call: overrides.do_not_call ?? false,
      inbound_allowed: overrides.inbound_allowed ?? true,
      seed_interests: overrides.seed_interests ?? null,
      seed_avoid_topics: overrides.seed_avoid_topics ?? null,
      allow_voice_reminder_control: overrides.allow_voice_reminder_control ?? true,
      voicemail_behavior: overrides.voicemail_behavior ?? 'brief',
    })
    .select()
    .single();

  if (error || !line) {
    throw new Error(error?.message || 'Failed to create test line');
  }

  return line as LineRow;
}

export function createAnonClient() {
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is required for RLS tests');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function cleanupTestData(params: {
  accountId?: string;
  organizationId?: number;
  userId?: string;
}) {
  if (params.accountId) {
    await testServiceRoleClient
      .from('ultaura_accounts')
      .delete()
      .eq('id', params.accountId);
  }

  if (params.organizationId) {
    await testServiceRoleClient
      .from('memberships')
      .delete()
      .eq('organization_id', params.organizationId);

    await testServiceRoleClient
      .from('organizations')
      .delete()
      .eq('id', params.organizationId);
  }

  if (params.userId) {
    await testServiceRoleClient
      .from('users')
      .delete()
      .eq('id', params.userId);

    await testServiceRoleClient.auth.admin.deleteUser(params.userId);
  }
}
