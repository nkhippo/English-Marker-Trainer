import { buildSystemBlocks } from '../prompts/system.js';
import { buildUserPrompt } from '../prompts/user.js';
import { generateSetFromApi } from '../api/claude.js';
import { allocateTags } from './tagAllocator.js';
import { allocateScenes } from './sceneAllocator.js';
import { allocateModalPools } from './poolPicker.js';
import { allocateNounGrids } from './gridAllocator.js';
import { validateItem, validateSet, sanitizeItemReasonCodes } from './validators.js';
import { getPresetName } from '../constants/presets.js';

function buildMeta(tagAllocation, sceneAllocations, poolAllocations, gridAllocations, index) {
  return {
    expectedTag: tagAllocation[index],
    expectedScene: sceneAllocations[index],
    expectedPool: poolAllocations[index],
    expectedGrid: gridAllocations[index] ?? null,
  };
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
    const { valid, errors } = validateItem(set.items[i], meta);
    if (!valid) {
      throw new Error(`問${i + 1}の生成に失敗しました: ${errors.join('; ')}`);
    }
  }

  const setValidation = validateSet(set);
  if (!setValidation.valid) {
    throw new Error(`セット検証失敗: ${setValidation.errors.join('; ')}`);
  }

  return set;
}
