/**
 * Dump system / user prompts to prompt-dumps/
 * Usage: npm run dump-prompts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSystemPrompt } from '../src/prompts/system.js';
import { buildUserPrompt } from '../src/prompts/user.js';
import { ALL_TAG_IDS } from '../src/constants/tags.js';
import { allocateNounGrids } from '../src/utils/gridAllocator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'prompt-dumps');

function formatMd(title, text) {
  return `## ${title}\n\n\`\`\`\n${text}\n\`\`\``;
}

fs.mkdirSync(OUT, { recursive: true });

const system = buildSystemPrompt();
const tagAllocation = ALL_TAG_IDS.slice(0, 10);
const gridAllocations = allocateNounGrids(tagAllocation);
const sampleUser = buildUserPrompt({
  tagAllocation,
  sceneAllocations: Array.from({ length: 10 }, (_, i) => ({
    sceneTag: ['買い物', '空港', '教室', '職場', '語学学校', '寮生活', '家庭', 'レストラン', 'キャリア', '旅行'][i],
    functionTag: '情報を得る',
  })),
  poolAllocations: [
    null, null, null, null, null,
    ['(bare)', 'can', 'would', 'may'],
    ['have to', 'must', 'should', 'may'],
    null, null, null,
  ],
  gridAllocations,
  presetName: 'ミックス診断',
  selectedTags: ALL_TAG_IDS,
});

fs.writeFileSync(
  path.join(OUT, 'system.md'),
  `# System Prompt (cache_control: ephemeral)\n\n${formatMd('System', system)}\n`,
  'utf8',
);

fs.writeFileSync(
  path.join(OUT, 'user-sample.md'),
  `# User Prompt Sample\n\n${formatMd('User', sampleUser)}\n`,
  'utf8',
);

console.log('wrote', path.join(OUT, 'system.md'));
console.log('wrote', path.join(OUT, 'user-sample.md'));
