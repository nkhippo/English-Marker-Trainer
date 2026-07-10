export const REASON_CODES = {
  N_DEF_NEW: { template: '初出・聞き手が特定できないので the は使えない', allowedTags: ['N-NP', 'N-UNC'] },
  N_DEF_NEEDED: { template: '既出／文脈で一意に決まるので the が必要', allowedTags: ['N-NP', 'N-UNC'] },
  N_NUM_SG: { template: '1つのものなので単数形', allowedTags: ['N-NP'] },
  N_NUM_PL: { template: '複数のものなので -s が必要', allowedTags: ['N-NP'] },
  N_A_PLURAL: { template: 'a は複数形と結合できない', allowedTags: ['N-NP'] },
  N_ARTICLE_REQUIRED: { template: '可算名詞の単数形には a / the / some などのマーカーが必要', allowedTags: ['N-NP'] },
  N_UNCOUNTABLE: { template: '不可算名詞なので a / -s は付かない', allowedTags: ['N-UNC'] },
  N_UNIT_OF: { template: '不可算名詞の単位表現（a cup/glass/piece of など）の要否が文脈と合わない', allowedTags: ['N-UNC'] },
  N_MARKER_MISMATCH: { template: 'some / any / a / the の使い分けが文の極性（肯定・疑問・否定）と合わない', allowedTags: ['N-NP', 'N-UNC'] },
  N_QNT_MISMATCH: { template: '数量詞が可算・不可算と対応していない', allowedTags: ['N-QNT'] },

  V_TENSE: { template: '文中の時の表現と時制が合わない', allowedTags: ['V-TA', 'M-AGR'] },
  V_ASPECT: { template: '相（進行・完了）の選択が文脈と合わない', allowedTags: ['V-TA', 'M-SEQ'] },
  V_VOICE: { template: '主語が動作をする側か受ける側かが逆', allowedTags: ['V-VOICE'] },

  V_MOD_TOO_WEAK: { template: '確信・強さが場面に対して弱すぎる', allowedTags: ['V-MOD-DYN', 'V-MOD-DEO'] },
  V_MOD_TOO_STRONG: { template: '確信・強さが場面に対して強すぎる', allowedTags: ['V-MOD-DYN', 'V-MOD-DEO'] },
  V_MOD_TENSE_MISMATCH: { template: '時間軸（過去・現在・未来）がずれている', allowedTags: ['V-MOD-DYN', 'V-MOD-DEO'] },
  V_MOD_SOURCE_MISMATCH: { template: '話者主観の必要性か外部事情の必要性かが逆', allowedTags: ['V-MOD-DEO'] },
  V_MOD_SENSE_MISMATCH: { template: '能力・許可・可能性のどれを言いたいかが噛み合っていない', allowedTags: ['V-MOD-DYN', 'V-MOD-DEO'] },
  V_MOD_REGISTER_MISMATCH: { template: '場面に対して堅すぎる／砕けすぎる言い方', allowedTags: ['V-MOD-DYN', 'V-MOD-DEO'] },

  M_AGR_NUMBER: { template: '主語の核の数と動詞が一致していない', allowedTags: ['M-AGR'] },
  M_AGR_PERSON: { template: '主語の人称と動詞が一致していない', allowedTags: ['M-AGR'] },
  M_PRON_NUM: { template: '先行詞の数と代名詞が一致していない', allowedTags: ['M-PRON-NUM'] },
  M_PRON_CASE: { template: '代名詞の格（主格・目的格・所有格）が違う', allowedTags: ['M-PRON-CASE'] },
  M_SEQ_TENSE: { template: '主節が過去なので従属節も過去へずらす', allowedTags: ['M-SEQ'] },
};

export function getReasonTemplate(code) {
  return REASON_CODES[code]?.template ?? code;
}

// 優先順位規則（要件定義 v0.4 §3.5）:
// V_TENSE と M_SEQ_TENSE が両方当てはまる場合、タグが M-SEQ なら M_SEQ_TENSE を優先。
// V_MOD_TOO_WEAK/TOO_STRONG と V_MOD_SENSE_MISMATCH が重なる場合、強さの軸で説明できるなら強さ系を優先。
