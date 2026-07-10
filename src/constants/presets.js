import { TAGS, ALL_TAG_IDS } from './tags.js';

export const PRESETS = [
  { id: 'mix', name: 'ミックス診断', desc: '全12タグから均等抽選', tags: ALL_TAG_IDS },
  { id: 'noun', name: '名詞まわり', desc: '冠詞・単複・数量', tags: ['N-NP', 'N-UNC', 'N-QNT'] },
  { id: 'verb-form', name: '動詞の形', desc: '時制・相・態', tags: ['V-TA', 'V-VOICE'] },
  { id: 'modal', name: '助動詞のニュアンス', desc: 'can/must/have to など', tags: ['V-MOD-DYN', 'V-MOD-DEO'] },
  { id: 'agree', name: '一致', desc: '主語・代名詞・時制の照応', tags: ['M-AGR', 'M-PRON-NUM', 'M-PRON-CASE', 'M-SEQ'] },
];

export function getPresetById(id) {
  return PRESETS.find((p) => p.id === id);
}

export function getPresetName(id) {
  if (id === 'custom') return 'カスタム';
  return getPresetById(id)?.name ?? id;
}

export function getTagsForPreset(presetId, customTags = []) {
  if (presetId === 'custom') return customTags.length ? customTags : ALL_TAG_IDS;
  return getPresetById(presetId)?.tags ?? ALL_TAG_IDS;
}
