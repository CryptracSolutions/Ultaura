import { createClient } from '@supabase/supabase-js';

import { SupabaseVectorStore } from 'langchain/vectorstores/supabase';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import invariant from 'tiny-invariant';

import { Database } from '~/database.types';

async function getVectorStore() {
  const client = getSupabaseClient();

  return SupabaseVectorStore.fromExistingIndex(new OpenAIEmbeddings(), {
    client,
    tableName: 'documents',
    queryName: 'match_documents',
  });
}

export default getVectorStore;

function getSupabaseClient() {
  const env = process.env;

  invariant(env.NEXT_PUBLIC_SUPABASE_URL, `Supabase URL not provided`);

  invariant(
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    `Supabase Anon Key not provided`,
  );

  invariant(
    env.SUPABASE_SERVICE_ROLE_KEY,
    `Supabase Service Role Key not provided`,
  );

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}
