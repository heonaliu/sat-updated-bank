// One-time migration: reads the old vanilla-app question data files (plain
// `const X = [...]` globals, no exports — so they are read as raw text and
// JSON.parse'd, NOT require()'d/import()'d) and batch-writes them into
// Firestore as `questions_english/{id}` and `questions_math/{id}`.
//
// Usage:
//   1. Download a service account key from Firebase Console > Project
//      Settings > Service Accounts > Generate new private key.
//   2. Save it as web/serviceAccountKey.json (already .gitignore'd).
//   3. node scripts/migrate.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(keyPath)) {
  console.error(`Missing ${keyPath}\nDownload it from Firebase Console > Project Settings > Service Accounts.`);
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = getFirestore();

function extractArray(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const jsonText = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
  return JSON.parse(jsonText);
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate id "${item.id}" in ${label}`);
    seen.add(item.id);
  }
}

// Firestore rejects arrays nested directly inside arrays ("invalid nested
// entity") — the math data's table.rows is string[][], so reshape each row
// into {cells: [...]} (array of maps is fine). content.js's buildTableHtml
// reads row.cells to match.
function sanitizeTable(table) {
  if (!table) return table;
  const sanitized = { headers: table.headers, rows: table.rows.map((row) => ({ cells: row })) };
  if (table.title) sanitized.title = table.title;
  return sanitized;
}

async function migrateSubject(name, items) {
  assertUniqueIds(items, name);
  const collectionRef = db.collection(`questions_${name}`);
  let batch = db.batch();
  let opCount = 0;
  for (let i = 0; i < items.length; i++) {
    const docData = { ...items[i], order: i };
    if (docData.table) docData.table = sanitizeTable(docData.table);
    batch.set(collectionRef.doc(items[i].id), docData);
    opCount++;
    if (opCount === 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();
  console.log(`✓ ${name}: wrote ${items.length} questions`);
}

const englishPath = path.join(__dirname, '..', '..', 'app', 'data', 'english.js');
const mathPath = path.join(__dirname, '..', '..', 'app', 'data', 'math.js');

const english = extractArray(englishPath);
const math = extractArray(mathPath);

console.log(`Parsed english.js: ${english.length} questions`);
console.log(`Parsed math.js: ${math.length} questions`);

await migrateSubject('english', english);
await migrateSubject('math', math);

console.log('Migration complete.');
process.exit(0);
