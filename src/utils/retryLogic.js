import { buildSystemBlocks } from '../prompts/system.js';
import { buildUserPrompt } from '../prompts/user.js';
import { generateSetFromApi } from '../api/claude.js';
import { allocateTags } from './tagAllocator.js';
import { allocateScenes } from './sceneAllocator.js';
import { allocateModalPools } from './poolPicker.js';
import { allocateNounGrids } from './gridAllocator.js';
import { validateItem, validateSet, sanitizeItemReasonCodes, sanitizeModalPoolOptions, sanitizeNounLexicalFields, sanitizeContextAndIdiom, sanitizeLemmaOverflow } from './validators.js';
import { shuffleItemOptions } from './shuffleOptions.js';
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
    let item = sanitizeItemReasonCodes(set.items[i]);
    item = sanitizeModalPoolOptions(item, meta.expectedPool);
    item = sanitizeNounLexicalFields(item, meta.expectedGrid);
    item = sanitizeContextAndIdiom(item, meta.expectedScene);
    item = shuffleItemOptions(item);
    set.items[i] = item;
    const { valid, errors } = validateItem(item, meta);
    if (!valid) {
      throw new Error(`問${i + 1}の生成に失敗しました: ${errors.join('; ')}`);
    }
  }

  set.items = sanitizeLemmaOverflow(set.items);

  const setValidation = validateSet(set);
  if (!setValidation.valid) {
    // template 側の重複は書き換え不能なため、sanitize 後に残る V11 のみ許容する
    const hard = setValidation.errors.filter((e) => e !== 'V11: lemma overflow');
    if (hard.length) {
      throw new Error(`セット検証失敗: ${hard.join('; ')}`);
    }
  }

  return set;
}
