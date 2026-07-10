import { buildSystemBlocks } from '../prompts/system.js';
import { buildUserPrompt } from '../prompts/user.js';
import { generateSetFromApi, regenerateItemFromApi } from '../api/claude.js';
import { allocateTags } from './tagAllocator.js';
import { allocateScenes } from './sceneAllocator.js';
import { allocateModalPools } from './poolPicker.js';
import { allocateNounGrids } from './gridAllocator.js';
import { validateItem, validateSet, sanitizeItemReasonCodes } from './validators.js';
import { getPresetName } from '../constants/presets.js';
import { getOverflowingLemmas, itemUsesLemma } from './lemmaCounter.js';

const MAX_RETRIES = 5;
const MAX_SET_RETRIES = 3;

function unwrapGeneratedItem(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload.items) && payload.items.length >= 1) {
    return payload.items[0];
  }
  return payload;
}

function buildMeta(tagAllocation, sceneAllocations, poolAllocations, gridAllocations, index) {
  return {
    expectedTag: tagAllocation[index],
    expectedScene: sceneAllocations[index],
    expectedPool: poolAllocations[index],
    expectedGrid: gridAllocations[index] ?? null,
  };
}

async function regenerateItemAtIndex({
  set,
  index,
  tagAllocation,
  sceneAllocations,
  poolAllocations,
  gridAllocations,
  presetName,
  selectedTags,
  systemBlocks,
  validationErrors,
  avoidLemmas,
}) {
  const meta = buildMeta(tagAllocation, sceneAllocations, poolAllocations, gridAllocations, index);
  const regenPrompt = buildUserPrompt({
    tagAllocation,
    sceneAllocations,
    poolAllocations,
    gridAllocations,
    presetName,
    selectedTags,
    singleItem: {
      id: index + 1,
      tag: meta.expectedTag,
      scene: meta.expectedScene,
      pool: meta.expectedPool,
      grid: meta.expectedGrid,
    },
    validationErrors,
    avoidLemmas,
  });
  const item = await regenerateItemFromApi(regenPrompt, systemBlocks);
  set.items[index] = sanitizeItemReasonCodes({
    ...unwrapGeneratedItem(item),
    id: index + 1,
    tag: meta.expectedTag,
    ...meta.expectedScene,
    ...(meta.expectedPool ? { poolUsed: meta.expectedPool } : {}),
    ...(meta.expectedGrid
      ? {
          gridVariant: meta.expectedGrid.variant,
          gridPatterns: meta.expectedGrid.patterns,
        }
      : {}),
  });
  return validateItem(set.items[index], meta);
}

export async function generateSet(userConfig) {
  const { presetId, selectedTags } = userConfig;
  const tagAllocation = allocateTags(selectedTags);
  const sceneAllocations = allocateScenes(10, tagAllocation);
  const poolAllocations = allocateModalPools(tagAllocation);
  const gridAllocations = allocateNounGrids(tagAllocation);
  const presetName = getPresetName(presetId);

  const systemBlocks = buildSystemBlocks();
  const userPrompt = buildUserPrompt({
    tagAllocation,
    sceneAllocations,
    poolAllocations,
    gridAllocations,
    presetName,
    selectedTags,
  });

  const raw = await generateSetFromApi(userPrompt, systemBlocks);

  const set = {
    ...raw,
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    preset: presetId,
    selectedTags,
    tagAllocation,
    items: raw.items ?? [],
  };

  for (let i = 0; i < 10; i++) {
    const meta = buildMeta(tagAllocation, sceneAllocations, poolAllocations, gridAllocations, i);
    set.items[i] = sanitizeItemReasonCodes(set.items[i]);
    let attempts = 0;
    let { valid, errors } = validateItem(set.items[i], meta);

    while (!valid && attempts < MAX_RETRIES) {
      ({ valid, errors } = await regenerateItemAtIndex({
        set,
        index: i,
        tagAllocation,
        sceneAllocations,
        poolAllocations,
        gridAllocations,
        presetName,
        selectedTags,
        systemBlocks,
        validationErrors: errors,
      }));
      attempts++;
    }

    if (!valid) {
      throw new Error(`問${i + 1}の生成に失敗しました（${MAX_RETRIES}回リトライ後）: ${errors.join('; ')}`);
    }
  }

  for (let setAttempt = 0; setAttempt <= MAX_SET_RETRIES; setAttempt++) {
    const setValidation = validateSet(set);
    if (setValidation.valid) return set;

    const v11Error = setValidation.errors.find((e) => e.includes('V11'));
    if (!v11Error || setAttempt === MAX_SET_RETRIES) {
      throw new Error(`セット検証失敗: ${setValidation.errors.join('; ')}`);
    }

    const overflowLemmas = getOverflowingLemmas(set.items);
    if (!overflowLemmas.length) {
      throw new Error(`セット検証失敗: ${setValidation.errors.join('; ')}`);
    }

    let regenIndex = -1;
    for (let i = 9; i >= 0; i--) {
      if (itemUsesLemma(set.items[i], overflowLemmas[0])) {
        regenIndex = i;
        break;
      }
    }
    if (regenIndex < 0) {
      throw new Error(`セット検証失敗: ${setValidation.errors.join('; ')}`);
    }

    let attempts = 0;
    let { valid, errors } = { valid: false, errors: [v11Error] };
    while (!valid && attempts < MAX_RETRIES) {
      ({ valid, errors } = await regenerateItemAtIndex({
        set,
        index: regenIndex,
        tagAllocation,
        sceneAllocations,
        poolAllocations,
        gridAllocations,
        presetName,
        selectedTags,
        systemBlocks,
        validationErrors: errors,
        avoidLemmas: overflowLemmas.slice(0, 6),
      }));
      attempts++;
    }

    if (!valid) {
      throw new Error(`問${regenIndex + 1}の語彙重複修正に失敗しました: ${errors.join('; ')}`);
    }
  }

  return set;
}
