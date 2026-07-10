import { useState } from 'react';
import { TAGS } from '../constants/tags.js';
import { C } from '../constants/theme.js';
import QuestionFeedback from './QuestionFeedback.jsx';

function splitTemplate(template) {
  const idx = template.indexOf('___');
  if (idx === -1) return { before: template, after: '' };
  return { before: template.slice(0, idx), after: template.slice(idx + 3) };
}

export default function QuestionScreen({
  item,
  index,
  total,
  reviewed,
  picked,
  score,
  onSelect,
  onNext,
}) {
  const [choicesOpen, setChoicesOpen] = useState(false);
  const pickedOpt = item.options.find((o) => o.key === picked);
  const correctOpt = item.options.find((o) => o.correct);
  const isCorrect = Boolean(pickedOpt?.correct);
  const blankParts = splitTemplate(item.template);
  const progress = Math.round(((index + (reviewed ? 1 : 0)) / total) * 100);
  const tagName = TAGS[item.tag]?.name ?? '出題';
  const subtitle = `${tagName} · ${item.sceneTag}`;

  function choiceStyle(choice) {
    const base = { border: `1px solid ${C.line}`, background: C.card };
    if (!reviewed) return base;
    const isAnswer = choice.key === correctOpt?.key;
    if (isAnswer) {
      return {
        border: `2px solid ${C.correctBorder}`,
        background: C.correctBg,
        color: C.correctText,
        fontWeight: 600,
      };
    }
    if (choice.key === picked) {
      return {
        border: `2px solid ${C.wrongBorder}`,
        background: C.wrongBg,
        color: C.wrongText,
        fontWeight: 600,
      };
    }
    return { ...base, opacity: 0.5 };
  }

  return (
    <>
      <p className="question-subtitle">{subtitle}</p>

      <div className="progress-row">
        <span>{index + 1} / {total}</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        {index > 0 || reviewed ? (
          <span className="progress-score">正解 {score}</span>
        ) : (
          <span className="progress-score progress-score--placeholder" aria-hidden>正解 0</span>
        )}
      </div>

      <div className="question-card">
        {item.contextEn && (
          <p className="context-line">{item.contextEn}</p>
        )}
        <p className="ja-line">{item.ja}</p>
        <p className="en-line">
          {blankParts.before}
          <span className="en-blank">___</span>
          {blankParts.after}
        </p>

        <div className={`choices-accordion${reviewed ? ' choices-accordion--answered' : ''}`}>
          {!reviewed && (
            <button
              type="button"
              className="choices-toggle"
              onClick={() => setChoicesOpen((open) => !open)}
              aria-expanded={choicesOpen}
            >
              <span>{choicesOpen ? '選択肢を隠す' : '選択肢を表示する'}</span>
              <span className="choices-chevron" aria-hidden>{choicesOpen ? '▲' : '▼'}</span>
            </button>
          )}
          <div className={`choices-panel${choicesOpen || reviewed ? ' is-open' : ''}`}>
            <div className="choices-row">
              {item.options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className="choice-btn"
                  style={choiceStyle(opt)}
                  onClick={() => onSelect(opt.key)}
                  disabled={reviewed || !choicesOpen}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        {reviewed && pickedOpt && correctOpt && (
          <div
            className="question-feedback"
            style={{
              background: isCorrect ? C.correctBg : C.wrongBg,
              borderColor: isCorrect ? '#bbf7d0' : '#fecdd3',
            }}
          >
            <div className="question-feedback-header">
              <p className="question-verdict">
                {isCorrect ? '✓ 正解' : `✗ 正解は ${correctOpt.text}`}
              </p>
              <button type="button" className="phrase-next-btn" onClick={onNext}>
                {index === total - 1 ? '結果を見る' : '次へ'}
              </button>
            </div>
            <div className="question-feedback-body">
              <QuestionFeedback item={item} pickedKey={picked} isCorrect={isCorrect} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
