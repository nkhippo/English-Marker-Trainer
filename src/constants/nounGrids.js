/**
 * 名詞タグの4択グリッドバリアント。
 * {n} は headNoun（単数原形）に置換し、{n}s は複数形に展開する。
 */
export const NOUN_GRID_VARIANTS = {
  'N-NP': {
    'article-singular': {
      label: '冠詞×単数/複数',
      patterns: ['a {n}', 'the {n}', '{n}', '{n}s'],
      countability: 'countable',
      note: '可算名詞。裸形 {n} は単数では冠詞不足。初出なら a、既知なら the。',
    },
    determiners: {
      label: 'a/the/some/any',
      patterns: ['a {n}', 'the {n}', 'some {n}s', 'any {n}s'],
      countability: 'countable',
      note: '可算名詞。some は肯定・勧誘、any は疑問・否定で自然。template に some/any を固定で入れない（選択肢側に含める）。',
    },
  },
  'N-UNC': {
    'article-bare': {
      label: '冠詞×不可算',
      patterns: ['{n}', 'a {n}', '{n}s', 'the {n}'],
      countability: 'uncountable',
      note: '不可算名詞。a / 複数形は不可。the は特定化の文脈でのみ。',
    },
    'some-any': {
      label: '裸形/some/any/the',
      patterns: ['{n}', 'some {n}', 'any {n}', 'the {n}'],
      countability: 'uncountable',
      note: '不可算名詞。Is there ___? などでは any が自然。肯定・勧誘では some。template に some/any を固定で入れない。',
    },
  },
};

export const NOUN_LEXICAL_TAGS = new Set(['N-NP', 'N-UNC', 'N-QNT']);
