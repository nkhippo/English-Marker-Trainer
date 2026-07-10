import { PRESETS, getTagsForPreset } from '../constants/presets.js';
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

  const toggleTag = (tagId) => {
    const next = customTags.includes(tagId)
      ? customTags.filter((t) => t !== tagId)
      : [...customTags, tagId];
    onCustomTagsChange(next);
  };

  const canStart = activeTags.length > 0;

  return (
    <>
      <header className="top">
        <div className="brand">Marker Trainer</div>
        <div className="brand-name">英語マーカー感度トレーナー</div>
        <div className="brand-sub">冠詞・単複・時制・助動詞などの判別感度を10問で測る</div>
      </header>
      <div className="screen">
        <div className="setup-section">
          <h2>プリセット</h2>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`preset-btn ${p.id === presetId ? 'active' : ''}`}
                onClick={() => onPresetChange(p.id)}
              >
                {p.name}
                <small>{p.desc}</small>
              </button>
            ))}
            <button
              type="button"
              className={`preset-btn ${isCustom ? 'active' : ''}`}
              onClick={() => onPresetChange('custom')}
            >
              カスタム
              <small>タグを個別に選択</small>
            </button>
          </div>

          {isCustom && (
            <div className="custom-tags">
              {ALL_TAG_IDS.map((tagId) => (
                <label key={tagId} className="tag-check">
                  <input
                    type="checkbox"
                    checked={customTags.includes(tagId)}
                    onChange={() => toggleTag(tagId)}
                  />
                  <span>{TAGS[tagId].name}</span>
                  <small>{CATEGORIES[TAGS[tagId].category]}</small>
                </label>
              ))}
            </div>
          )}

          <div className="tags-detail">
            <span className="cat">対象タグ：</span>
            {tagNames || '（タグを1つ以上選択）'}
          </div>
          <div className="idiom-note">
            慣用句・定型表現（Would you like ~? / May I help you? など）は本アプリでは扱いません。別アプリで学習してください。
          </div>

          {!apiConfigured && (
            <div className="api-note">
              API 未設定のため、デモ用モックデータで動作します。本番生成には GAS エンドポイント（VITE_GAS_ENDPOINT）が必要です。
            </div>
          )}

          {apiConfigured && (
            <label className="mock-toggle">
              <input type="checkbox" checked={useMock} onChange={(e) => onToggleMock(e.target.checked)} />
              デモモード（モックデータを使用）
            </label>
          )}
        </div>
        <button type="button" className="primary-btn" disabled={!canStart} onClick={onStart}>
          10問を生成する
        </button>
      </div>
    </>
  );
}
