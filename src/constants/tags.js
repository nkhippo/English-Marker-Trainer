export const TAGS = {
  'N-NP': { name: '冠詞と単複', category: 'N', selectMode: 'fixed' },
  'N-UNC': { name: '可算・不可算', category: 'N', selectMode: 'fixed' },
  'N-QNT': { name: '数量の表し方', category: 'N', selectMode: 'fixed' },
  'V-TA': { name: '時制と相', category: 'V', selectMode: 'fixed' },
  'V-VOICE': { name: '能動・受動', category: 'V', selectMode: 'fixed' },
  'V-MOD-DYN': { name: 'できる・だろうの言い方', category: 'V', selectMode: 'pool' },
  'V-MOD-DEO': { name: 'しなければ・すべきの言い方', category: 'V', selectMode: 'pool' },
  'M-AGR': { name: '主語と動詞の一致', category: 'M', selectMode: 'fixed' },
  'M-PRON-NUM': { name: '代名詞の数', category: 'M', selectMode: 'fixed' },
  'M-PRON-CASE': { name: '代名詞の格', category: 'M', selectMode: 'fixed' },
  'M-SEQ': { name: '時制の一致', category: 'M', selectMode: 'fixed' },
};

export const CATEGORIES = {
  N: '名詞のかたち',
  V: '動詞のかたち',
  M: '整合',
};

export const CONTEXT_REQUIRED_TAGS = ['N-NP', 'N-UNC', 'V-MOD-DYN', 'V-MOD-DEO'];

export const ALL_TAG_IDS = Object.keys(TAGS);
