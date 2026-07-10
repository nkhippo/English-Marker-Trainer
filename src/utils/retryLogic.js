import { buildSystemBlocks } from '../prompts/system.js';
import { buildUserPrompt } from '../prompts/user.js';
import { generateSetFromApi, regenerateItemFromApi } from '../api/claude.js';
import { allocateTags } from './tagAllocator.js';
import { allocateScenes } from './sceneAllocator.js';
import { allocateModalPools } from './poolPicker.js';
import { validateItem, validateSet } from './validators.js';
import { getPresetName } from '../constants/presets.js';

const MAX_RETRIES = 3;

function unwrapGeneratedItem(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload.items) && payload.items.length >= 1) {
    return payload.items[0];
  }
  return payload;
}

function buildMeta(tagAllocation, sceneAllocations, poolAllocations, index) {
  return {
    expectedTag: tagAllocation[index],
    expectedScene: sceneAllocations[index],
    expectedPool: poolAllocations[index],
  };
}

export async function generateSet(userConfig) {
  const { presetId, selectedTags } = userConfig;
  const tagAllocation = allocateTags(selectedTags);
  const sceneAllocations = allocateScenes(10, tagAllocation);
  const poolAllocations = allocateModalPools(tagAllocation);
  const presetName = getPresetName(presetId);

  const systemBlocks = buildSystemBlocks();
  const userPrompt = buildUserPrompt({
    tagAllocation,
    sceneAllocations,
    poolAllocations,
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
    const meta = buildMeta(tagAllocation, sceneAllocations, poolAllocations, i);
    let attempts = 0;
    let { valid, errors } = validateItem(set.items[i], meta);

    while (!valid && attempts < MAX_RETRIES) {
      const regenPrompt = buildUserPrompt({
        tagAllocation,
        sceneAllocations,
        poolAllocations,
        presetName,
        selectedTags,
        singleItem: {
          id: i + 1,
          tag: meta.expectedTag,
          scene: meta.expectedScene,
          pool: meta.expectedPool,
        },
      });
      const item = await regenerateItemFromApi(regenPrompt, systemBlocks);
      set.items[i] = {
        ...unwrapGeneratedItem(item),
        id: i + 1,
        tag: meta.expectedTag,
        ...meta.expectedScene,
        ...(meta.expectedPool ? { poolUsed: meta.expectedPool } : {}),
      };
      ({ valid, errors } = validateItem(set.items[i], meta));
      attempts++;
    }

    if (!valid) {
      throw new Error(`問${i + 1}の生成に失敗しました（${MAX_RETRIES}回リトライ後）: ${errors.join('; ')}`);
    }
  }

  const setValidation = validateSet(set);
  if (!setValidation.valid) {
    throw new Error(`セット検証失敗: ${setValidation.errors.join('; ')}`);
  }

  return set;
}
