'use client';

import React from 'react';

import Badge from '~/core/ui/Badge';
import Alert from '~/core/ui/Alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '~/core/ui/Table';
import TableEmptyState from '~/core/ui/TableEmptyState';
import { formatDate } from '~/lib/utils/format-date';

import type {
  SafeStripeCustomer,
  SafeStripeSubscription,
  SafeStripeInvoice,
} from '../stripe-queries';

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface DbSubscription {
  id: string;
  account_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  billing_interval: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

interface BillingResultsProps {
  dbSubscription: DbSubscription;
  stripeCustomer: SafeStripeCustomer | null;
  stripeSubscription: SafeStripeSubscription | null;
  stripeInvoices: SafeStripeInvoice[];
  stripeCustomerError?: string;
  stripeSubscriptionError?: string;
  stripeInvoicesError?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function stripeUrl(
  type: 'customers' | 'subscriptions' | 'invoices',
  id: string,
  livemode: boolean,
): string {
  const base = 'https://dashboard.stripe.com';
  const prefix = livemode ? '' : '/test';
  return `${base}${prefix}/${type}/${id}`;
}

function formatCurrency(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function formatTimestamp(ts: number): string {
  return formatDate(new Date(ts * 1000));
}

type BadgeColor = 'success' | 'warn' | 'error' | 'info' | 'normal';

function statusBadgeColor(status: string | null): BadgeColor {
  switch (status) {
    case 'active':
      return 'success';
    case 'past_due':
      return 'warn';
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      return 'error';
    case 'trialing':
    case 'incomplete':
      return 'info';
    default:
      return 'normal';
  }
}

function invoiceStatusColor(status: string | null): BadgeColor {
  switch (status) {
    case 'paid':
      return 'success';
    case 'open':
      return 'info';
    case 'draft':
      return 'normal';
    case 'void':
    case 'uncollectible':
      return 'error';
    default:
      return 'normal';
  }
}

/* ------------------------------------------------------------------ */
/*  Card shell                                                        */
/* ------------------------------------------------------------------ */

function Card(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="rounded-xl bg-card p-5 border border-border">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {props.title}
      </h3>
      {props.children}
    </div>
  );
}

function Row(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="flex items-start justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{props.label}</span>
      <span className="text-right font-medium">{props.children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function BillingResults({
  dbSubscription,
  stripeCustomer,
  stripeSubscription,
  stripeInvoices,
  stripeCustomerError,
  stripeSubscriptionError,
  stripeInvoicesError,
}: BillingResultsProps) {
  const livemode =
    stripeCustomer?.livemode ?? stripeSubscription?.livemode ?? false;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- DB Subscription ---- */}
      <Card title="Database Subscription">
        <Row label="Subscription ID">{dbSubscription.id}</Row>
        <Row label="Account ID">{dbSubscription.account_id}</Row>
        <Row label="Plan ID">{dbSubscription.plan_id ?? '--'}</Row>
        <Row label="Status">
          <Badge color={statusBadgeColor(dbSubscription.status)} size="small">
            {dbSubscription.status ?? 'unknown'}
          </Badge>
        </Row>
        <Row label="Billing Interval">
          {dbSubscription.billing_interval ?? '--'}
        </Row>
        <Row label="Period">
          {formatDate(dbSubscription.current_period_start)} {' \u2192 '}{' '}
          {formatDate(dbSubscription.current_period_end)}
        </Row>
        <Row label="Cancel at Period End">
          {dbSubscription.cancel_at_period_end ? 'Yes' : 'No'}
        </Row>
        <Row label="Stripe Customer ID">
          <span className="font-mono text-xs">
            {dbSubscription.stripe_customer_id ?? '--'}
          </span>
        </Row>
        <Row label="Stripe Subscription ID">
          <span className="font-mono text-xs">
            {dbSubscription.stripe_subscription_id ?? '--'}
          </span>
        </Row>
      </Card>

      {/* ---- Stripe Customer ---- */}
      <Card title="Stripe Customer">
        {stripeCustomerError ? (
          <Alert type="error">{stripeCustomerError}</Alert>
        ) : stripeCustomer ? (
          <>
            <Row label="Customer ID">
              <span className="font-mono text-xs">{stripeCustomer.id}</span>
            </Row>
            <Row label="Email">{stripeCustomer.email ?? '--'}</Row>
            <Row label="Name">{stripeCustomer.name ?? '--'}</Row>
            <Row label="Mode">
              <Badge
                color={stripeCustomer.livemode ? 'success' : 'warn'}
                size="small"
              >
                {stripeCustomer.livemode ? 'Live' : 'Test'}
              </Badge>
            </Row>
            <Row label="Created">{formatTimestamp(stripeCustomer.created)}</Row>
            <div className="mt-3 pt-3 border-t border-border">
              <a
                href={stripeUrl(
                  'customers',
                  stripeCustomer.id,
                  stripeCustomer.livemode,
                )}
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline"
              >
                Open in Stripe Dashboard &rarr;
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Stripe customer found.
          </p>
        )}
      </Card>

      {/* ---- Stripe Subscription ---- */}
      <Card title="Stripe Subscription">
        {stripeSubscriptionError ? (
          <Alert type="error">{stripeSubscriptionError}</Alert>
        ) : stripeSubscription ? (
          <>
            <Row label="Subscription ID">
              <span className="font-mono text-xs">{stripeSubscription.id}</span>
            </Row>
            <Row label="Status">
              <Badge
                color={statusBadgeColor(stripeSubscription.status)}
                size="small"
              >
                {stripeSubscription.status}
              </Badge>
            </Row>
            <Row label="Mode">
              <Badge
                color={stripeSubscription.livemode ? 'success' : 'warn'}
                size="small"
              >
                {stripeSubscription.livemode ? 'Live' : 'Test'}
              </Badge>
            </Row>

            {/* Price items */}
            {stripeSubscription.items.length > 0 && (
              <div className="mt-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Price Items
                </span>
                {stripeSubscription.items.map((item) => (
                  <div
                    key={item.priceId}
                    className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div className="font-medium">
                      {item.productName ?? item.priceId}
                    </div>
                    <div className="text-muted-foreground">
                      {item.unitAmount !== null
                        ? formatCurrency(item.unitAmount, item.currency)
                        : 'Usage-based'}{' '}
                      / {item.interval}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Row label="Current Period">
              {formatTimestamp(stripeSubscription.currentPeriodStart)}{' '}
              {'\u2192'} {formatTimestamp(stripeSubscription.currentPeriodEnd)}
            </Row>

            {stripeSubscription.trialEnd && (
              <Row label="Trial End">
                {formatTimestamp(stripeSubscription.trialEnd)}
              </Row>
            )}

            <Row label="Cancel at Period End">
              {stripeSubscription.cancelAtPeriodEnd ? 'Yes' : 'No'}
            </Row>

            {stripeSubscription.cancelAt && (
              <Row label="Cancel At">
                {formatTimestamp(stripeSubscription.cancelAt)}
              </Row>
            )}

            {/* Payment method */}
            {stripeSubscription.defaultPaymentMethod && (
              <Row label="Payment Method">
                {stripeSubscription.defaultPaymentMethod.brand.toUpperCase()}{' '}
                **** {stripeSubscription.defaultPaymentMethod.last4}
                {' \u00B7 '}
                {String(
                  stripeSubscription.defaultPaymentMethod.expMonth,
                ).padStart(2, '0')}
                /{stripeSubscription.defaultPaymentMethod.expYear}
              </Row>
            )}

            <div className="mt-3 pt-3 border-t border-border">
              <a
                href={stripeUrl(
                  'subscriptions',
                  stripeSubscription.id,
                  stripeSubscription.livemode,
                )}
                target="_blank"
                rel="noopener"
                className="text-sm text-primary hover:underline"
              >
                Open in Stripe Dashboard &rarr;
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Stripe subscription found.
          </p>
        )}
      </Card>

      {/* ---- Recent Invoices ---- */}
      <Card title="Recent Invoices">
        {stripeInvoicesError ? (
          <Alert type="error">{stripeInvoicesError}</Alert>
        ) : stripeInvoices.length > 0 ? (
          <div className="-mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stripeInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(inv.created)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatCurrency(inv.amountDue, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={invoiceStatusColor(inv.status)}
                        size="small"
                      >
                        {inv.status ?? 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noopener"
                          className="text-primary hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <a
                          href={stripeUrl('invoices', inv.id, livemode)}
                          target="_blank"
                          rel="noopener"
                          className="text-primary hover:underline"
                        >
                          Stripe
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState message="No invoices found." />
        )}
      </Card>
    </div>
  );
}
