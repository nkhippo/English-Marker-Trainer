import { getReasonTemplate } from '../constants/reasonCodes.js';

function OptionNote({ text, why, appliedMeaning }) {
  return (
    <div className="feedback-option-note">
      <p className="feedback-option-label">
        <strong>{text}</strong>
      </p>
      {why && <p className="feedback-option-why">{why}</p>}
      {appliedMeaning && (
        <p className="feedback-sample">
          <span className="feedback-sample-label">意味</span>
          {appliedMeaning}
        </p>
      )}
    </div>
  );
}

export default function QuestionFeedback({ item, pickedKey, isCorrect }) {
  const picked = item.options.find((o) => o.key === pickedKey);
  const correct = item.options.find((o) => o.correct);
  const otherOptions = item.options.filter((o) => {
    if (o.key === pickedKey) return false;
    if (!isCorrect && o.correct) return false;
    return true;
  });

  if (!picked || !correct) return null;

  const pickedWhy = !isCorrect
    ? [getReasonTemplate(picked.reasonCode), picked.note].filter(Boolean).join(' ')
    : null;

  return (
    <div className="feedback-detail">
      <div className="feedback-selected-note">
        <p className="feedback-selected-label">
          <strong>{picked.text}</strong>
          {isCorrect ? ' — あなたの回答' : ' — あなたが選んだ解答'}
        </p>
        {isCorrect ? (
          <p className="feedback-option-why">この文脈では正しい選択です。</p>
        ) : (
          <>
            <p className="feedback-option-why">{pickedWhy || 'この文脈では正解になりません。'}</p>
            {picked.appliedMeaning && (
              <p className="feedback-sample">
                <span className="feedback-sample-label">意味</span>
                {picked.appliedMeaning}
              </p>
            )}
          </>
        )}
      </div>

      {!isCorrect && (
        <div className="feedback-correct-note">
          <p className="feedback-selected-label">
            <strong>{correct.text}</strong> — 正解の理由
          </p>
          <p className="feedback-option-why">この場面・文脈ではこの形が最も自然です。</p>
        </div>
      )}

      {otherOptions.length > 0 && (
        <div className="feedback-other-choices">
          <p className="feedback-other-label">{isCorrect ? 'ほかの選択肢' : 'ほかの誤答'}</p>
          {otherOptions.map((opt) => (
            <OptionNote
              key={opt.key}
              text={opt.text}
              why={[getReasonTemplate(opt.reasonCode), opt.note].filter(Boolean).join(' ')}
              appliedMeaning={opt.appliedMeaning}
            />
          ))}
        </div>
      )}
    </div>
  );
}
