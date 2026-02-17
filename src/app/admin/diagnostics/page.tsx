import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import { getRecentAuditLogs } from '~/lib/ultaura/admin/audit-log';
import getStripeInstance from '~/core/stripe/get-stripe';
import configuration from '~/configuration';
import getLogger from '~/core/logger';

import DiagnosticCard from './components/DiagnosticCard';
import type { DiagnosticStatus } from './components/DiagnosticCard';
import AuditLogTable from './components/AuditLogTable';

export const metadata = {
  title: `Diagnostics | ${configuration.site.siteName}`,
};

interface DiagnosticCheck {
  name: string;
  status: DiagnosticStatus;
  details: string;
  error?: string;
}

const ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'ADMIN_ENFORCE_MFA',
  'ULTAURA_INTERNAL_API_SECRET',
] as const;

async function checkSupabaseAdmin(): Promise<DiagnosticCheck> {
  try {
    const client = getSupabaseServerComponentClient({ admin: true });
    const { count, error } = await client
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        name: 'Supabase Admin Client',
        status: 'fail',
        details: 'Failed to query users table.',
        error: error.message,
      };
    }

    return {
      name: 'Supabase Admin Client',
      status: 'pass',
      details: `Users table accessible. Row count: ${count ?? 0}.`,
    };
  } catch (err) {
    return {
      name: 'Supabase Admin Client',
      status: 'fail',
      details: 'Exception while querying users table.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkSupabaseAuth(): Promise<DiagnosticCheck> {
  try {
    const client = getSupabaseServerComponentClient({ admin: true });
    const { data, error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      return {
        name: 'Supabase Auth Admin',
        status: 'fail',
        details: 'Failed to list auth users.',
        error: error.message,
      };
    }

    if (!data.users || data.users.length === 0) {
      return {
        name: 'Supabase Auth Admin',
        status: 'fail',
        details: 'Auth admin responded but returned 0 users.',
      };
    }

    return {
      name: 'Supabase Auth Admin',
      status: 'pass',
      details: `Auth admin accessible. Found ${data.users.length} user(s) in first page.`,
    };
  } catch (err) {
    return {
      name: 'Supabase Auth Admin',
      status: 'fail',
      details: 'Exception while listing auth users.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkStripe(): Promise<DiagnosticCheck> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      name: 'Stripe API',
      status: 'fail',
      details: 'Missing STRIPE_SECRET_KEY environment variable.',
    };
  }

  try {
    const stripe = await getStripeInstance();
    const account = await stripe.accounts.retrieve() as { charges_enabled?: boolean; livemode?: boolean };

    const mode = account.charges_enabled !== undefined
      ? (account.livemode ? 'live' : 'test')
      : 'unknown';

    return {
      name: 'Stripe API',
      status: 'pass',
      details: `Stripe key valid. Mode: ${mode}.`,
    };
  } catch (err) {
    return {
      name: 'Stripe API',
      status: 'fail',
      details: 'Failed to connect to Stripe.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkEnvironment(): DiagnosticCheck {
  const present: string[] = [];
  const missing: string[] = [];

  for (const key of ENV_VARS) {
    if (process.env[key]) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  const status: DiagnosticStatus =
    missing.length === 0 ? 'pass' : missing.length <= 2 ? 'warn' : 'fail';

  const details =
    missing.length === 0
      ? `All ${present.length} environment variables present.`
      : `Missing: ${missing.join(', ')}. Present: ${present.length}/${ENV_VARS.length}.`;

  return {
    name: 'Environment Variables',
    status,
    details,
  };
}

async function checkTelephonyEventLog(): Promise<DiagnosticCheck> {
  try {
    const client = getSupabaseServerComponentClient({ admin: true });
    const { data, error, count } = await client
      .from('ultaura_telephony_event_log' as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return {
        name: 'Telephony Event Log',
        status: 'fail',
        details: 'Failed to query telephony event log.',
        error: error.message,
      };
    }

    const rows = (data ?? []) as Array<{ created_at: string }>;
    const total = count ?? rows.length;

    if (rows.length === 0) {
      return {
        name: 'Telephony Event Log',
        status: 'pass',
        details: 'Query succeeded. No events yet.',
      };
    }

    const mostRecent = rows[0]?.created_at
      ? new Date(rows[0].created_at).toLocaleString()
      : 'unknown';

    return {
      name: 'Telephony Event Log',
      status: 'pass',
      details: `${total} total event(s). Most recent: ${mostRecent}.`,
    };
  } catch (err) {
    return {
      name: 'Telephony Event Log',
      status: 'fail',
      details: 'Exception while querying telephony event log.',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function DiagnosticsPage() {
  const logger = getLogger();

  // Run all checks in parallel for resilience
  const [
    supabaseAdminResult,
    supabaseAuthResult,
    stripeResult,
    telephonyResult,
  ] = await Promise.allSettled([
    checkSupabaseAdmin(),
    checkSupabaseAuth(),
    checkStripe(),
    checkTelephonyEventLog(),
  ]);

  const envCheck = checkEnvironment();

  const checks: DiagnosticCheck[] = [
    supabaseAdminResult.status === 'fulfilled'
      ? supabaseAdminResult.value
      : {
          name: 'Supabase Admin Client',
          status: 'fail' as const,
          details: 'Check crashed unexpectedly.',
          error:
            supabaseAdminResult.reason instanceof Error
              ? supabaseAdminResult.reason.message
              : String(supabaseAdminResult.reason),
        },
    supabaseAuthResult.status === 'fulfilled'
      ? supabaseAuthResult.value
      : {
          name: 'Supabase Auth Admin',
          status: 'fail' as const,
          details: 'Check crashed unexpectedly.',
          error:
            supabaseAuthResult.reason instanceof Error
              ? supabaseAuthResult.reason.message
              : String(supabaseAuthResult.reason),
        },
    stripeResult.status === 'fulfilled'
      ? stripeResult.value
      : {
          name: 'Stripe API',
          status: 'fail' as const,
          details: 'Check crashed unexpectedly.',
          error:
            stripeResult.reason instanceof Error
              ? stripeResult.reason.message
              : String(stripeResult.reason),
        },
    envCheck,
    telephonyResult.status === 'fulfilled'
      ? telephonyResult.value
      : {
          name: 'Telephony Event Log',
          status: 'fail' as const,
          details: 'Check crashed unexpectedly.',
          error:
            telephonyResult.reason instanceof Error
              ? telephonyResult.reason.message
              : String(telephonyResult.reason),
        },
  ];

  // Fetch audit logs separately with its own error handling
  let auditLogs: Array<{
    id: string;
    created_at: string;
    admin_email: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
  }> = [];
  let auditError: string | null = null;

  try {
    const result = await getRecentAuditLogs(20);
    auditLogs = (result.logs ?? []) as unknown as typeof auditLogs;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err);
    auditError = message;
    logger.error({ error: err }, 'Diagnostics: failed to fetch audit logs');
  }

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader>Diagnostics</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <div className="text-sm text-muted-foreground">
            System health checks and admin audit trail.{' '}
            <span className="font-medium">
              {passCount} passed, {warnCount} warnings, {failCount} failed
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {checks.map((check) => (
              <DiagnosticCard
                key={check.name}
                name={check.name}
                status={check.status}
                details={check.details}
                error={check.error}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">
              Admin Audit Log (Last 20)
            </h2>

            {auditError ? (
              <p className="text-sm text-destructive">
                Failed to load audit logs: {auditError}
              </p>
            ) : (
              <AuditLogTable logs={auditLogs} />
            )}
          </div>
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(DiagnosticsPage);
