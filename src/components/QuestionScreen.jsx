import ProgressBar, { TagChip } from './ProgressBar.jsx';
import OptionButton from './OptionButton.jsx';

export default function QuestionScreen({
  item,
  index,
  total,
  reviewed,
  picked,
  onSelect,
  onNext,
}) {
  const templateHtml = item.template.replace('___', '<span class="blank">___</span>');

  return (
    <>
      <header className="top">
        <div className="brand">Marker Trainer</div>
      </header>
      <div className="screen">
        <div className="progress">
          <TagChip tagId={item.tag} sceneTag={item.sceneTag} />
          <span className="progress-count">{index + 1} / {total}</span>
        </div>
        <ProgressBar current={index} total={total} reviewed={reviewed} />

        {item.contextEn && (
          <div className="context-en">
            <span className="context-label">Context</span>
            {item.contextEn}
          </div>
        )}

        <div className="ja-sentence">{item.ja}</div>
        <div
          className="en-template"
          dangerouslySetInnerHTML={{ __html: templateHtml }}
        />

        <div className="options">
          {item.options.map((opt) => (
            <OptionButton
              key={opt.key}
              option={opt}
              reviewed={reviewed}
              picked={picked}
              onSelect={onSelect}
            />
          ))}
        </div>

        {reviewed && (
          <div className="next-bar">
            <button type="button" className="primary-btn" onClick={onNext}>
              {index === total - 1 ? '結果を見る' : '次の問題へ'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
