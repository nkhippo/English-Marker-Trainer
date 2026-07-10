import {
  SCENE_ENTRIES,
  FUNCTION_TAGS,
  LAYER2_SCENES,
  pickRandomScene,
} from '../constants/scenePool.js';

function buildScenePool(includeLayer2) {
  const base = SCENE_ENTRIES.flatMap((e) => e.scenes);
  if (!includeLayer2) return base;
  return [...base, ...LAYER2_SCENES.flatMap((e) => e.scenes)];
}

/**
 * scenePool から10問分抽選。同一 sceneTag は最大2問。
 * V-MOD-DYN が tagAllocation に含まれるとき LAYER2_SCENES を抽選対象に加える。
 */
export function allocateScenes(count, tagAllocation = []) {
  const includeLayer2 = tagAllocation.includes('V-MOD-DYN');
  const scenePool = buildScenePool(includeLayer2);
  const sceneCounts = {};
  const results = [];

  let attempts = 0;
  while (results.length < count && attempts < 1000) {
    attempts++;
    const sceneTag = scenePool[Math.floor(Math.random() * scenePool.length)];
    if ((sceneCounts[sceneTag] ?? 0) >= 2) continue;

    const functionTag = FUNCTION_TAGS[Math.floor(Math.random() * FUNCTION_TAGS.length)];
    sceneCounts[sceneTag] = (sceneCounts[sceneTag] ?? 0) + 1;
    results.push({ sceneTag, functionTag });
  }

  if (results.length < count) {
    while (results.length < count) {
      results.push(pickRandomScene());
    }
  }

  return results;
}

export function countSceneTags(allocations) {
  const counts = {};
  for (const { sceneTag } of allocations) {
    counts[sceneTag] = (counts[sceneTag] ?? 0) + 1;
  }
  return counts;
}
