import Link from 'next/link';

import {
  MagnifyingGlassIcon,
  UserIcon,
  BuildingOfficeIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';

import { PageBody } from '~/core/ui/Page';
import { TextFieldInput } from '~/core/ui/TextField';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Heading from '~/core/ui/Heading';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import configuration from '~/configuration';
import getLogger from '~/core/logger';

import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

import {
  searchByEmail,
  searchByPhone,
  searchByUid,
  searchByLinePhone,
} from '~/app/admin/search/queries';

import type { SearchResultUser } from '~/app/admin/search/queries';

export const metadata = {
  title: `Search | ${configuration.site.siteName}`,
};

type SearchType = 'email' | 'phone' | 'uid' | 'line_phone';
const VALID_SEARCH_TYPES = new Set<SearchType>([
  'email',
  'phone',
  'uid',
  'line_phone',
]);

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  email: 'Email',
  phone: 'Phone',
  uid: 'User ID',
  line_phone: 'Line Phone',
};

const SEARCH_TYPE_PLACEHOLDERS: Record<SearchType, string> = {
  email: 'user@example.com',
  phone: '+15551234567',
  uid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  line_phone: '+15559876543',
};

interface SearchPageProps {
  searchParams: {
    q?: string;
    type?: string;
  };
}

async function SearchPage({ searchParams }: SearchPageProps) {
  const searchQuery = (searchParams.q ?? '').trim();
  const searchType = validateSearchType(searchParams.type);

  let results: SearchResultUser[] = [];
  let searchError: string | null = null;
  let searched = false;

  if (searchQuery.length > 0) {
    searched = true;

    try {
      const client = getSupabaseServerComponentClient({ admin: true });

      switch (searchType) {
        case 'email':
          results = await searchByEmail(client, searchQuery);
          break;
        case 'phone':
          results = await searchByPhone(client, searchQuery);
          break;
        case 'uid':
          results = await searchByUid(client, searchQuery);
          break;
        case 'line_phone':
          results = await searchByLinePhone(client, searchQuery);
          break;
      }

      // Audit log the search
      try {
        const admin = await getCurrentAdminContext();

        if (admin) {
          await writeAdminAuditLog(admin, {
            action: 'admin.search',
            metadata: {
              query: searchQuery,
              type: searchType,
              resultCount: results.length,
            },
          });
        }
      } catch {
        // Audit log failure should not break search
      }
    } catch (err) {
      const logger = getLogger();
      logger.error({ err }, 'Admin search failed');
      searchError =
        err instanceof Error ? err.message : 'Search failed. Please try again.';
    }
  }

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Search</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-6'}>
          {/* Search Form */}
          <div
            className={
              'rounded-lg border border-border bg-background p-5 space-y-4'
            }
          >
            <Heading type={5}>Find Users, Accounts, and Lines</Heading>

            <form method={'GET'} className={'flex flex-col space-y-4'}>
              <div className={'flex flex-col sm:flex-row gap-3'}>
                <div className={'flex-1'}>
                  <TextFieldInput
                    name={'q'}
                    defaultValue={searchQuery}
                    placeholder={SEARCH_TYPE_PLACEHOLDERS[searchType]}
                    autoFocus
                  />
                </div>

                <div className={'w-full sm:w-48'}>
                  <select
                    name={'type'}
                    defaultValue={searchType}
                    className={
                      'flex h-11 min-h-[44px] w-full rounded-md border border-input ' +
                      'bg-background px-3 py-2 text-base sm:text-sm transition-colors ' +
                      'focus:outline-none focus:border-primary disabled:cursor-not-allowed ' +
                      'disabled:opacity-50'
                    }
                  >
                    {Object.entries(SEARCH_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Button type={'submit'} variant={'default'}>
                    <MagnifyingGlassIcon className={'h-4 w-4'} />
                    <span>Search</span>
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Error */}
          {searchError && (
            <Alert type={'error'}>
              <Alert.Heading>Search Error</Alert.Heading>
              {searchError}
            </Alert>
          )}

          {/* No Results */}
          {searched && !searchError && results.length === 0 && (
            <div
              className={
                'rounded-lg border border-border bg-background p-8 text-center text-muted-foreground'
              }
            >
              <MagnifyingGlassIcon
                className={'mx-auto h-10 w-10 mb-3 opacity-40'}
              />
              <p className={'text-sm'}>
                No results found for &ldquo;{searchQuery}&rdquo; (
                {SEARCH_TYPE_LABELS[searchType]}).
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className={'space-y-2'}>
              <p className={'text-sm text-muted-foreground'}>
                Found {results.length} user{results.length !== 1 ? 's' : ''}
              </p>

              <div className={'space-y-4'}>
                {results.map((user) => (
                  <UserResultCard key={user.id} user={user} />
                ))}
              </div>
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(SearchPage);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserResultCard({ user }: { user: SearchResultUser }) {
  return (
    <div
      className={
        'rounded-lg border border-border bg-background overflow-hidden'
      }
    >
      {/* User Header */}
      <div className={'border-b border-border bg-muted/30 px-5 py-4'}>
        <div className={'flex items-start justify-between gap-4'}>
          <div className={'flex items-center gap-3 min-w-0'}>
            <div
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
              }
            >
              <UserIcon className={'h-4 w-4'} />
            </div>

            <div className={'min-w-0'}>
              <div className={'flex items-center gap-2 flex-wrap'}>
                <span className={'font-medium text-sm truncate'}>
                  {user.email ?? 'No email'}
                </span>

                {user.isBanned ? (
                  <Badge size={'small'} color={'error'}>
                    Banned
                  </Badge>
                ) : (
                  <Badge size={'small'} color={'success'}>
                    Active
                  </Badge>
                )}
              </div>

              <p
                className={
                  'text-xs text-muted-foreground font-mono mt-0.5 truncate'
                }
              >
                <Link
                  href={`/admin/users/${user.id}`}
                  className={'hover:underline'}
                >
                  {user.id}
                </Link>
              </p>
            </div>
          </div>

          <Button variant={'outline'} size={'small'} href={`/admin/users/${user.id}`}>
            View User
          </Button>
        </div>

        <div
          className={
            'mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground'
          }
        >
          {user.phone && (
            <div>
              <span className={'font-medium'}>Phone:</span> {user.phone}
            </div>
          )}
          <div>
            <span className={'font-medium'}>Created:</span>{' '}
            {formatDate(user.createdAt)}
          </div>
          {user.lastSignInAt && (
            <div>
              <span className={'font-medium'}>Last sign-in:</span>{' '}
              {formatDate(user.lastSignInAt)}
            </div>
          )}
        </div>
      </div>

      {/* Organizations */}
      <div className={'px-5 py-4 space-y-3'}>
        {user.organizations.length === 0 && (
          <p className={'text-xs text-muted-foreground'}>
            No organization memberships.
          </p>
        )}

        {user.organizations.map((org) => {
          const orgAccounts = user.accounts.filter(
            (a) => a.organizationId === org.id,
          );

          return (
            <div
              key={org.id}
              className={
                'rounded-md border border-border bg-muted/20 p-4 space-y-3'
              }
            >
              {/* Org row */}
              <div className={'flex items-center gap-2'}>
                <BuildingOfficeIcon
                  className={'h-4 w-4 text-muted-foreground shrink-0'}
                />
                <Link
                  href={`/admin/organizations/${org.uuid}/members`}
                  className={'text-sm font-medium hover:underline truncate'}
                >
                  {org.name}
                </Link>
                <Badge size={'small'} color={'normal'}>
                  Role {org.role}
                </Badge>
              </div>

              {/* Accounts under this org */}
              {orgAccounts.length === 0 && (
                <p className={'text-xs text-muted-foreground pl-6'}>
                  No Ultaura accounts.
                </p>
              )}

              {orgAccounts.map((account) => {
                const accountLines = user.lines.filter(
                  (l) => l.accountId === account.id,
                );

                return (
                  <div
                    key={account.id}
                    className={
                      'ml-6 rounded border border-border bg-background p-3 space-y-2'
                    }
                  >
                    {/* Account row */}
                    <div className={'flex items-center gap-2 flex-wrap'}>
                      <Link
                        href={`/admin/accounts/${account.id}`}
                        className={'text-sm font-medium hover:underline'}
                      >
                        {account.name}
                      </Link>
                      <AccountStatusBadge status={account.status} />
                      {account.planId && (
                        <Badge size={'small'} color={'info'}>
                          {account.planId}
                        </Badge>
                      )}
                      <span
                        className={
                          'text-xs font-mono text-muted-foreground ml-auto hidden sm:inline'
                        }
                      >
                        <Link
                          href={`/admin/accounts/${account.id}`}
                          className={'hover:underline'}
                        >
                          {account.id}
                        </Link>
                      </span>
                    </div>

                    {/* Lines under this account */}
                    {accountLines.length > 0 && (
                      <div className={'space-y-1 pt-1'}>
                        {accountLines.map((line) => (
                          <div
                            key={line.id}
                            className={
                              'flex items-center gap-2 text-sm py-1 pl-2 border-l-2 border-border'
                            }
                          >
                            <PhoneIcon
                              className={
                                'h-3.5 w-3.5 text-muted-foreground shrink-0'
                              }
                            />
                            <Link
                              href={`/admin/lines/${line.id}`}
                              className={'font-medium hover:underline'}
                            >
                              {line.displayName}
                            </Link>
                            <span
                              className={
                                'text-xs font-mono text-muted-foreground'
                              }
                            >
                              {line.phoneE164}
                            </span>
                            <LineStatusBadge status={line.status} />
                            <span
                              className={
                                'text-xs font-mono text-muted-foreground ml-auto hidden sm:inline'
                              }
                            >
                              <Link
                                href={`/admin/lines/${line.id}`}
                                className={'hover:underline'}
                              >
                                {line.id}
                              </Link>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {accountLines.length === 0 && (
                      <p className={'text-xs text-muted-foreground'}>
                        No lines.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, 'success' | 'warn' | 'error' | 'normal'> = {
    active: 'success',
    trial: 'info' as 'success',
    suspended: 'error',
    cancelled: 'error',
  };

  const color = colorMap[status] ?? 'normal';

  return (
    <Badge size={'small'} color={color}>
      {status}
    </Badge>
  );
}

function LineStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, 'success' | 'warn' | 'error' | 'normal'> = {
    active: 'success',
    paused: 'warn',
    suspended: 'error',
  };

  const color = colorMap[status] ?? 'normal';

  return (
    <Badge size={'small'} color={color}>
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateSearchType(type?: string): SearchType {
  if (type && VALID_SEARCH_TYPES.has(type as SearchType)) {
    return type as SearchType;
  }

  return 'email';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
