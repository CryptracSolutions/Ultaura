import 'server-only';

import { getResendClient } from './client';
import {
  getTopicId,
  TOPIC_KEYS,
  type TopicKey,
  getResendSegmentId,
} from './topics';

type ResendApiError = {
  name?: string;
  message: string;
  statusCode?: number;
};

type UpdateContactResult =
  | {
      ok: true;
      contactId: string;
    }
  | {
      ok: false;
      reason: 'not_found' | 'error';
      message: string;
    };

function isNotFoundError(error: ResendApiError | null | undefined): boolean {
  if (!error) return false;
  return error.name === 'not_found' || error.statusCode === 404;
}

async function updateContact(params: {
  id: string;
  unsubscribed?: boolean;
  firstName?: string | null;
}): Promise<UpdateContactResult> {
  const resend = getResendClient();
  const audienceId = getResendSegmentId();

  const { data, error } = await resend.contacts.update({
    id: params.id,
    audienceId,
    unsubscribed: params.unsubscribed,
    firstName: params.firstName || undefined,
  });

  if (error) {
    if (isNotFoundError(error)) {
      return { ok: false, reason: 'not_found', message: error.message };
    }
    return { ok: false, reason: 'error', message: error.message };
  }

  return {
    ok: true,
    contactId: data?.id || params.id,
  };
}

export async function syncContactTopics(contactId: string, selectedTopicKeys: TopicKey[]): Promise<void> {
  const resend = getResendClient() as any;
  const selected = new Set(selectedTopicKeys);
  const topics = TOPIC_KEYS.map((topicKey) => ({
    id: getTopicId(topicKey),
    subscription: selected.has(topicKey) ? ('opt_in' as const) : ('opt_out' as const),
  }));

  const { error } = await resend.patch(`/contacts/${encodeURIComponent(contactId)}/topics`, {
    topics,
  });

  if (error) {
    throw new Error(`Resend topic sync failed: ${error.message}`);
  }
}

/**
 * Create a pending Resend contact (segment member, unsubscribed=true).
 */
export async function createPendingContact(
  email: string,
  firstName: string | null,
  source: string,
): Promise<string> {
  const resend = getResendClient();
  const { data, error } = await resend.contacts.create({
    email,
    firstName: firstName || undefined,
    unsubscribed: true,
    audienceId: getResendSegmentId(),
  });
  if (error) throw new Error(`Resend contact create failed: ${error.message}`);
  return data!.id;
}

export async function ensureResendContact(
  email: string,
  firstName: string | null,
  resendContactId: string | null,
): Promise<string> {
  if (resendContactId) {
    const updated = await updateContact({ id: resendContactId, firstName });
    if (updated.ok) {
      return updated.contactId;
    }
    if (updated.reason === 'error') {
      throw new Error(`Resend contact update failed: ${updated.message}`);
    }
  }

  const resend = getResendClient();
  const { data, error } = await resend.contacts.create({
    email,
    firstName: firstName || undefined,
    unsubscribed: true,
    audienceId: getResendSegmentId(),
  });
  if (error) throw new Error(`Resend contact create failed: ${error.message}`);
  return data!.id;
}

export async function confirmResendContact(
  resendContactId: string,
  email: string,
  firstName: string | null,
  topicKeys: TopicKey[],
): Promise<string> {
  const contactId = resendContactId || (await ensureResendContact(email, firstName, null));
  const updateResult = await updateContact({
    id: contactId,
    unsubscribed: false,
    firstName,
  });

  let resolvedContactId = contactId;
  if (!updateResult.ok) {
    if (updateResult.reason === 'error') {
      throw new Error(`Resend contact update failed: ${updateResult.message}`);
    }

    const resend = getResendClient();
    const { data, error } = await resend.contacts.create({
      email,
      firstName: firstName || undefined,
      unsubscribed: false,
      audienceId: getResendSegmentId(),
    });
    if (error) throw new Error(`Resend contact create failed: ${error.message}`);
    resolvedContactId = data!.id;
  } else {
    resolvedContactId = updateResult.contactId;
  }

  await syncContactTopics(resolvedContactId, topicKeys);
  return resolvedContactId;
}

export async function unsubscribeResendContact(
  resendContactId: string,
  topicKeys: TopicKey[] = [],
): Promise<void> {
  const updateResult = await updateContact({
    id: resendContactId,
    unsubscribed: true,
  });

  if (!updateResult.ok && updateResult.reason === 'error') {
    throw new Error(`Resend contact unsubscribe failed: ${updateResult.message}`);
  }

  if (updateResult.ok) {
    await syncContactTopics(updateResult.contactId, topicKeys);
  }
}
