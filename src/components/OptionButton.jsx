import { getReasonTemplate } from '../constants/reasonCodes.js';

export default function OptionButton({ option, reviewed, picked, onSelect }) {
  if (!reviewed) {
    return (
      <button type="button" className="option-btn" onClick={() => onSelect(option.key)}>
        <span className="option-key">{option.key}</span>
        <span className="option-text">{option.text}</span>
      </button>
    );
  }

  const isCorrect = option.correct;
  const isPicked = option.key === picked;
  let cls = 'option-btn reviewed ';
  if (isCorrect && isPicked) cls += 'correct-picked';
  else if (isCorrect) cls += 'correct';
  else if (isPicked) cls += 'wrong-picked';
  else cls += 'wrong';

  return (
    <div className={cls}>
      <div className="review-header">
        <div className={`badge ${isCorrect ? 'correct' : 'wrong'}`}>{isCorrect ? '✓' : '✕'}</div>
        <span className="option-key">{option.key}</span>
        <span className="option-text en-text">{option.text}</span>
      </div>
      {isCorrect ? (
        <div className="review-body">
          <div className="review-reason correct-label">正解</div>
        </div>
      ) : (
        <OptionReview option={option} />
      )}
    </div>
  );
}

function OptionReview({ option }) {
  return <OptionReviewContent option={option} />;
}

export function OptionReviewContent({ option }) {
  const reasonText = option.reasonCode ? getReasonTemplate(option.reasonCode) : null;

  return (
    <div className="review-body">
      {reasonText && (
        <div className="review-reason">
          <strong>なぜ不正解か</strong>
          {reasonText}
        </div>
      )}
      {option.note && <div className="review-note">{option.note}</div>}
      {option.appliedMeaning && (
        <div className="review-applied">
          <strong>この語を選ぶと</strong>
          {option.appliedMeaning}
        </div>
      )}
    </div>
  );
}
