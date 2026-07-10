import { PRESETS, getTagsForPreset, getPresetById } from '../constants/presets.js';
import { TAGS, CATEGORIES, ALL_TAG_IDS } from '../constants/tags.js';

export default function SetupScreen({
  presetId,
  customTags,
  onPresetChange,
  onCustomTagsChange,
  onStart,
  useMock,
  onToggleMock,
  apiConfigured,
}) {
  const isCustom = presetId === 'custom';
  const activeTags = isCustom ? customTags : getTagsForPreset(presetId);
  const tagNames = activeTags.map((t) => TAGS[t].name).join('・');
  const preset = isCustom ? null : getPresetById(presetId);
  const canStart = activeTags.length > 0;

  const toggleTag = (tagId) => {
    const next = customTags.includes(tagId)
      ? customTags.filter((t) => t !== tagId)
      : [...customTags, tagId];
    onCustomTagsChange(next);
  };

  return (
    <div className="setup-screen">
      <h2 className="title">何を練習する？</h2>
      <p className="sub">
        プリセットから選ぶか、タグを個別にカスタム選択できます。慣用句・定型表現は扱いません。
      </p>

      <div className="modes">
        <button
          type="button"
          className={!isCustom ? 'active' : ''}
          onClick={() => onPresetChange(presetId === 'custom' ? 'mix' : presetId)}
        >
          プリセット
        </button>
        <button
          type="button"
          className={isCustom ? 'active' : ''}
          onClick={() => onPresetChange('custom')}
        >
          カスタム
        </button>
      </div>

      {!isCustom && (
        <div className="steps">
          {PRESETS.map((p, i) => {
            const sel = p.id === presetId;
            return (
              <button
                key={p.id}
                type="button"
                className={`step${sel ? ' sel' : ''}`}
                onClick={() => onPresetChange(p.id)}
              >
                <span className="no">{i + 1}</span>
                <span className="body">
                  <span className="nm">{p.name}</span>
                  <span className="ds">{p.desc}</span>
                </span>
                <span className="check" />
              </button>
            );
          })}
        </div>
      )}

      {isCustom && (
        <div className="steps">
          {ALL_TAG_IDS.map((tagId, i) => {
            const sel = customTags.includes(tagId);
            return (
              <button
                key={tagId}
                type="button"
                className={`step${sel ? ' sel' : ''}`}
                onClick={() => toggleTag(tagId)}
              >
                <span className="no">{i + 1}</span>
                <span className="body">
                  <span className="nm">{TAGS[tagId].name}</span>
                  <span className="ds">{CATEGORIES[TAGS[tagId].category]}</span>
                </span>
                <span className="check" />
              </button>
            );
          })}
        </div>
      )}

      <p className="setup-desc">
        <span className="setup-desc-strong">
          {isCustom ? 'カスタム選択' : preset?.name}
        </span>
        {isCustom
          ? ` — ${tagNames || '（タグを1つ以上選択）'}`
          : ` — ${tagNames}`}
      </p>

      <p className="setup-note">
        慣用句・定型表現（Would you like ~? / May I help you? など）は本アプリでは扱いません。
      </p>

      {!apiConfigured && (
        <p className="setup-note setup-note--warn">
          API 未設定のため、デモ用モックデータで動作します。本番生成には GAS エンドポイント（VITE_GAS_ENDPOINT）が必要です。
        </p>
      )}

      {apiConfigured && (
        <label className="mock-toggle">
          <input type="checkbox" checked={useMock} onChange={(e) => onToggleMock(e.target.checked)} />
          デモモード（モックデータを使用）
        </label>
      )}

      <div className="phase-actions">
        <button type="button" className="btn primary" disabled={!canStart} onClick={onStart}>
          10問を生成する
        </button>
      </div>
    </div>
  );
}
