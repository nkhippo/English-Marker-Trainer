import { useState } from 'react';
import { TAGS, CATEGORIES } from '../constants/tags.js';

export default function ResultScreen({ set, answers, onExport, onRestart }) {
  const [openCats, setOpenCats] = useState({});

  const scoresByCat = {};
  const scoresByTag = {};

  set.items.forEach((item, i) => {
    const cat = TAGS[item.tag]?.category ?? '?';
    const picked = item.options.find((o) => o.key === answers[i]);
    const correct = Boolean(picked?.correct);

    if (!scoresByCat[cat]) scoresByCat[cat] = { correct: 0, total: 0 };
    scoresByCat[cat].correct += correct ? 1 : 0;
    scoresByCat[cat].total++;

    if (!scoresByTag[item.tag]) scoresByTag[item.tag] = { correct: 0, total: 0 };
    scoresByTag[item.tag].correct += correct ? 1 : 0;
    scoresByTag[item.tag].total++;
  });

  const totalCorrect = set.items.filter((item, i) => {
    const picked = item.options.find((o) => o.key === answers[i]);
    return picked?.correct;
  }).length;

  const pct = Math.round((totalCorrect / set.items.length) * 100);

  const toggleCat = (cat) => {
    setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="result-screen">
      <div className="result-hero">
        <p className="result-score">
          {totalCorrect}
          <span className="result-score-total"> / {set.items.length}</span>
        </p>
        <p className="result-pct">正答率 {pct}%</p>
      </div>

      <div className="result-categories">
        {Object.entries(scoresByCat).map(([cat, s]) => {
          const catPct = Math.round((s.correct / s.total) * 100);
          const tags = Object.entries(scoresByTag).filter(([t]) => TAGS[t]?.category === cat);
          const isOpen = openCats[cat];
          return (
            <div key={cat} className={`category-card${isOpen ? ' is-open' : ''}`}>
              <button type="button" className="category-head" onClick={() => toggleCat(cat)}>
                <span className="category-name">{CATEGORIES[cat] ?? cat}</span>
                <span className="category-bar">
                  <span className="category-bar-fill" style={{ width: `${catPct}%` }} />
                </span>
                <span className="category-score">{s.correct}/{s.total}</span>
                <span className="category-chevron" aria-hidden>▼</span>
              </button>
              {isOpen && (
                <div className="category-detail">
                  {tags.map(([tag, ts]) => (
                    <div key={tag} className="tag-row">
                      <span className="tag-name">{TAGS[tag]?.name}</span>
                      <span className="tag-score">{ts.correct}/{ts.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="result-actions">
        <button type="button" className="btn-secondary" onClick={onExport}>
          MDエクスポート
        </button>
        <button type="button" className="btn-primary btn-primary--compact" onClick={onRestart}>
          もう一度
        </button>
      </div>
    </div>
  );
}
