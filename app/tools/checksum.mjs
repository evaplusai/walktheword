// Recompute and stamp the edition checksum (ADR-001 §3). Run: npm run checksum
import { readFileSync, writeFileSync } from 'node:fs';
import { editionChecksum } from '../lib/graph.mjs';

const path = new URL('../data/edition-1.json', import.meta.url);
const data = JSON.parse(readFileSync(path, 'utf8'));
const sum = await editionChecksum(data);
if (data.edition.checksum === sum) {
  console.log(`unchanged ${sum}`);
} else {
  data.edition.checksum = sum;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`stamped ${sum}`);
}
