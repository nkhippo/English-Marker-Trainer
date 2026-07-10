/**
 * 名詞タグの4択グリッドバリアント。
 * {n} は headNoun（単数原形）に置換し、{n}s は複数形に展開する。
 * weight 未指定は 1。N-UNC の unit-of は低めにして「たまに」出す。
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
      weight: 2,
      note: '不可算名詞。a / 複数形は不可。the は特定化の文脈でのみ。',
    },
    'some-any': {
      label: '裸形/some/any/the',
      patterns: ['{n}', 'some {n}', 'any {n}', 'the {n}'],
      countability: 'uncountable',
      weight: 2,
      note: '不可算名詞。Is there ___? などでは any が自然。肯定・勧誘では some。template に some/any を固定で入れない。',
    },
    'unit-of': {
      label: '単位表現（a cup of 等）',
      patterns: ['{n}', 'a {n}', 'a cup of {n}', 'the {n}'],
      countability: 'uncountable',
      weight: 1,
      note:
        '不可算＋単位。a cup of {n} の cup は headNoun に合う単位（glass/bowl/piece/bottle/slice 等）に置き換えてよい（例: a cup of tea, a glass of water, a piece of advice）。headNoun は単位と相性の良い語を選ぶ。日本語が「一杯の」「1枚の」など量を示すなら単位表現を正解に。量を特定しないなら裸形を正解にし、単位表現は量を特定しすぎる誤答にする。a {n} は不可算なので常に誤答。',
    },
  },
};

export const NOUN_LEXICAL_TAGS = new Set(['N-NP', 'N-UNC', 'N-QNT']);
