// backend/scripts/seed.ts
// Run with:  npx ts-node scripts/seed.ts
// Or compile first: npx tsc && node dist/scripts/seed.js
//
// Creates demo users and documents for local testing.
// Requires Strapi to be running at http://localhost:1337

import axios from 'axios';

const BASE = 'http://localhost:1337';

interface DemoUser {
  username: string;
  email:    string;
  password: string;
}

interface DemoDoc {
  title:          string;
  content:        string;
  whiteboardJson?: string;
}

const DEMO_USERS: DemoUser[] = [
  { username: 'alice', email: 'demo1@collabdoc.app', password: 'Demo1234!' },
  { username: 'bob',   email: 'demo2@collabdoc.app', password: 'Demo1234!' },
];

const DEMO_DOCS: DemoDoc[] = [
  {
    title: '📋 Team Meeting Notes',
    content: JSON.stringify({
      ops: [
        { insert: 'Team Meeting Notes\n', attributes: { header: 1 } },
        { insert: '\n' },
        { insert: 'Agenda\n', attributes: { header: 2 } },
        { insert: '1. Sprint review\n2. Blockers\n3. Next steps\n\n' },
        {
          insert: 'This document is shared — edit it live!\n',
          attributes: { italic: true },
        },
      ],
    }),
  },
  {
    title: '🚀 Product Spec v1',
    content: JSON.stringify({
      ops: [
        { insert: 'CollabDoc Product Spec\n', attributes: { header: 1 } },
        { insert: '\nOverview\n', attributes: { header: 2 } },
        { insert: 'CollabDoc is a real-time collaborative editing platform.\n\n' },
        { insert: 'Goals\n', attributes: { header: 2 } },
        {
          insert:
            '• Low latency sync\n• Rich text + whiteboard\n• Strapi-powered backend\n',
        },
      ],
    }),
  },
  {
    title:          '🎨 Blank Whiteboard',
    content:        JSON.stringify({ ops: [{ insert: '\n' }] }),
    whiteboardJson: JSON.stringify({ version: '5.3.0', objects: [] }),
  },
];

async function seed(): Promise<void> {
  console.log('🌱 Seeding CollabDoc demo data…\n');

  const tokens: (string | null)[] = [];

  for (const u of DEMO_USERS) {
    try {
      const res = await axios.post<{ jwt: string }>(
        `${BASE}/api/auth/local/register`,
        u
      );
      tokens.push(res.data.jwt);
      console.log(`✅ Created user: ${u.username} (${u.email})`);
    } catch {
      // Already exists — login instead
      try {
        const res = await axios.post<{ jwt: string }>(
          `${BASE}/api/auth/local`,
          { identifier: u.email, password: u.password }
        );
        tokens.push(res.data.jwt);
        console.log(`ℹ️  User exists, logged in: ${u.username}`);
      } catch (err: any) {
        console.error(`❌ Could not create/login ${u.email}:`, err.message);
        tokens.push(null);
      }
    }
  }

  const aliceToken = tokens[0];
  if (!aliceToken) {
    console.error('Cannot create documents — alice token missing.');
    process.exit(1);
  }

  for (const doc of DEMO_DOCS) {
    try {
      await axios.post(
        `${BASE}/api/documents`,
        { data: doc },
        { headers: { Authorization: `Bearer ${aliceToken}` } }
      );
      console.log(`✅ Created document: ${doc.title}`);
    } catch (err: any) {
      console.error(
        `❌ Could not create doc "${doc.title}":`,
        err.response?.data ?? err.message
      );
    }
  }

  console.log('\n🎉 Seeding complete!');
  console.log('Demo credentials:');
  console.log('  Email: demo1@collabdoc.app  Password: Demo1234!');
  console.log('  Email: demo2@collabdoc.app  Password: Demo1234!');
}

seed();
