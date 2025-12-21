#!/usr/bin/env node

import { loadEnvConfig } from '@next/env';

import { Command } from 'commander';
import prompts from 'prompts';
import { readdirSync, statSync, existsSync, writeFileSync } from 'fs';
import matter from 'gray-matter';
import ora from 'ora';
import { createHash } from 'crypto';

import indexedFiles from './indexed-files.json';
import getVectorStore from '~/plugins/chatbot/lib/server/vector-store';

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  const program = new Command()
    .name('makerkit chatbot')
    .description('Generate your Chatbot knowledge base with AI')
    .version('-v, --version', 'display the version number');

  const { environment } = await prompts([
    {
      type: 'select',
      name: 'environment',
      message: `Select the environment where you want to index your documents`,
      choices: [
        {
          title: 'Development',
          value: 'development',
        },
        {
          title: 'Production',
          value: 'production',
        },
      ],
    },
  ]);

  const isProduction = environment === 'production';
  console.log(`Indexing into ${environment} DB`);

  // Load environment variables from .env files
  // if production, load from .env.production
  loadEnvConfig(process.cwd(), !isProduction);

  program.addCommand(generateChatBotDocsCommand());

  program.parse();
}

void main();

function generateChatBotDocsCommand() {
  return new Command()
    .name('generate')
    .description('Generate your Chatbot knowledge base with AI')
    .action(async () => {
      const { directory } = await prompts([
        {
          type: 'select',
          name: 'directory',
          message: `Select the directory where you want to load your MDX documents from`,
          choices: [
            {
              title: 'Docs',
              value: 'src/content/docs',
            },
            {
              title: 'Chatbot Questions',
              value: 'plugins/chatbot/questions',
            },
          ],
        },
      ]);

      if (!directory) {
        console.log(`No directory selected`);
        process.exit(0);
      }

      if (!existsSync(directory)) {
        console.log(`Directory ${directory} does not exist`);
        process.exit(0);
      }

      const vectorStore = await getVectorStore();
      const files = getFiles(directory);

      const generateEmbedLoader = ora(
        `Generating embeddings for ${files.length} documents\n`,
      ).start();

      let processed = 0;

      for (const file of files) {
        const { data, content } = matter.read(file);
        const question = data.question || data.title;

        if (!question) {
          console.warn(`No question found in ${file}\n`);
          continue;
        }

        // check if file has already been indexed
        const indexedFile = getIndexedFile(file);

        if (indexedFile) {
          const hash = sha256(content);

          if (indexedFile === hash) {
            console.warn(`Skipping ${file} as it has already been indexed`);
            continue;
          }
        }

        try {
          await vectorStore.addDocuments([
            {
              pageContent: content,
              metadata: {
                name: question,
              },
            },
          ]);

          console.log(`✅ Inserted "${question}" into database`);

          storeHash(file, sha256(content));

          processed++;
        } catch (error) {
          console.error(error);
          console.error(`❌ Failed to insert "${question}" into database`);
        }
      }

      generateEmbedLoader.succeed(
        `Generated embeddings for ${processed} documents\n`,
      );
    });
}

function getFiles(dir: string, files: string[] = []) {
  const fileList = readdirSync(dir);

  for (const file of fileList) {
    const filePath = `${dir}/${file}`;

    if (statSync(filePath).isDirectory()) {
      getFiles(filePath, files);
    } else {
      if (filePath.includes('.mdx')) {
        files.push(filePath);
      }
    }
  }

  return files;
}

function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

function getIndexLockFile() {
  return indexedFiles as Record<string, string>;
}

function getIndexedFile(file: string) {
  const lockFile = getIndexLockFile();

  return file in lockFile ? lockFile[file] : undefined;
}

function storeHash(file: string, hash: string) {
  const lockFile = getIndexLockFile();
  lockFile[file] = hash;

  writeFileSync(
    'plugins/chatbot/indexed-files.json',
    JSON.stringify(lockFile, null, 2),
  );
}
