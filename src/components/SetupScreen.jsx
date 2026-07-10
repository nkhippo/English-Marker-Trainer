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
  const topicPresets = PRESETS.filter((p) => p.id !== 'mix');
  const mixPreset = PRESETS.find((p) => p.id === 'mix');
  const activeTags = isCustom ? customTags : getTagsForPreset(presetId);
  const tagNames = activeTags.map((t) => TAGS[t].name).join('・');
  const preset = isCustom ? null : getPresetById(presetId);

  const toggleTag = (tagId) => {
    const next = customTags.includes(tagId)
      ? customTags.filter((t) => t !== tagId)
      : [...customTags, tagId];
    onCustomTagsChange(next);
  };

  const canStart = activeTags.length > 0;

  return (
    <div className="setup-screen">
      <div className="preset-row">
        {topicPresets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-card${p.id === presetId ? ' is-active' : ''}`}
            onClick={() => onPresetChange(p.id)}
          >
            <div className="preset-card-title">{p.name}</div>
            <div className="preset-card-sub">{p.desc}</div>
          </button>
        ))}
      </div>

      <div className="mode-row">
        <button
          type="button"
          className={`mode-card${presetId === 'mix' ? ' is-active' : ''}`}
          onClick={() => onPresetChange('mix')}
        >
          <div className="mode-card-title">{mixPreset.name}</div>
          <div className="mode-card-sub">{mixPreset.desc}</div>
        </button>
        <button
          type="button"
          className={`mode-card${isCustom ? ' is-active' : ''}`}
          onClick={() => onPresetChange('custom')}
        >
          <div className="mode-card-title">カスタム</div>
          <div className="mode-card-sub">タグを個別に選択</div>
        </button>
      </div>

      {isCustom && (
        <div className="custom-tags-card">
          {ALL_TAG_IDS.map((tagId) => (
            <label key={tagId} className="tag-check">
              <input
                type="checkbox"
                checked={customTags.includes(tagId)}
                onChange={() => toggleTag(tagId)}
              />
              <span className="tag-check-name">{TAGS[tagId].name}</span>
              <span className="tag-check-cat">{CATEGORIES[TAGS[tagId].category]}</span>
            </label>
          ))}
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

      <button type="button" className="btn-primary" disabled={!canStart} onClick={onStart}>
        10問を生成する
      </button>
    </div>
  );
}
