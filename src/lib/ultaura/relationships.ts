'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { getLine } from './lines';
import type { RelationshipRow } from './types';

const logger = getLogger();

export async function getRelationships(lineId: string): Promise<RelationshipRow[]> {
  const line = await getLine(lineId);
  if (!line) {
    return [];
  }

  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_relationships')
    .select('*')
    .eq('line_id', line.id)
    .order('times_mentioned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch relationships');
    return [];
  }

  return data ?? [];
}
