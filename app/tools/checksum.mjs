// Recompute and stamp each edition's checksum (ADR-001 §3, ADR-006 §2). Run: npm run checksum
import { readFileSync, writeFileSync } from 'node:fs';
import { editionChecksum } from '../lib/graph.mjs';

for (const name of ['edition-2-kjv.json', 'edition-2-web.json']) {
  const path = new URL(`../data/${name}`, import.meta.url);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const sum = await editionChecksum(data);
  if (data.edition.checksum === sum) {
    console.log(`${name}: unchanged ${sum}`);
  } else {
    data.edition.checksum = sum;
    writeFileSync(path, JSON.stringify(data) + '\n');
    console.log(`${name}: stamped ${sum}`);
  }
}
