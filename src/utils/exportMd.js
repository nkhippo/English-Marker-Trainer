import { TAGS } from '../constants/tags.js';
import { getReasonTemplate } from '../constants/reasonCodes.js';
import { getPresetName } from '../constants/presets.js';

/**
 * 全10問の MD エクスポート（プロトタイプ buildExportMd 準拠）
 */
export function buildExportMd(set, answers) {
  const lines = [
    `# Marker Trainer セット (${set.generatedAt?.slice(0, 10) ?? 'unknown'})`,
    `プリセット: ${getPresetName(set.preset) || set.preset}`,
    '',
  ];

  set.items.forEach((item, i) => {
    const picked = answers[i];
    const pickedOpt = item.options.find((o) => o.key === picked);
    const correctOpt = item.options.find((o) => o.correct);
    const tagName = TAGS[item.tag]?.name ?? '不明';

    lines.push(`## 問 ${i + 1} [${tagName}] — ${item.sceneTag}`);
    if (item.contextEn) lines.push(`Context: ${item.contextEn}`);
    lines.push(`日本語: ${item.ja}`);
    lines.push(`英訳: ${item.template}`);
    lines.push('');
    lines.push(`- 正解: **${correctOpt?.text}** (${correctOpt?.key})`);
    lines.push(`- あなたの回答: ${pickedOpt?.text ?? '（未回答）'} ${pickedOpt?.correct ? '✓' : '✕'}`);
    lines.push('');
    lines.push('### 全選択肢の意味');
    item.options.forEach((opt) => {
      lines.push(`- **${opt.key} ${opt.text}** ${opt.correct ? '(正解)' : ''}`);
      if (!opt.correct) {
        const reason = getReasonTemplate(opt.reasonCode);
        lines.push(`  - 理由: ${reason}`);
        if (opt.note) lines.push(`  - 補足: ${opt.note}`);
        if (opt.appliedMeaning) lines.push(`  - この語を選ぶと: ${opt.appliedMeaning}`);
      }
    });
    lines.push('');
    lines.push('> Claudeへの確認依頼: 上記 appliedMeaning（「この語を選ぶと」）の意味の記述は、実際にネイティブがその選択肢を使ったときに聞き取る意味として妥当ですか。ズレがあれば指摘してください。');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}

export function downloadMd(content, filename = 'marker-trainer-export.md') {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
