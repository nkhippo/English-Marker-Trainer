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

  const toggleCat = (cat) => {
    setOpenCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <>
      <header className="top">
        <div className="brand">Marker Trainer</div>
        <div className="brand-name">結果</div>
      </header>
      <div className="screen">
        <div className="result-summary">
          <div className="result-label">今回のスコア</div>
          <div>
            <span className="result-score">{totalCorrect}</span>
            <span className="result-score-total">/ 10</span>
          </div>
        </div>

        <div id="categories">
          {Object.entries(scoresByCat).map(([cat, s]) => {
            const pct = Math.round((s.correct / s.total) * 100);
            const tags = Object.entries(scoresByTag).filter(([t]) => TAGS[t]?.category === cat);
            const isOpen = openCats[cat];
            return (
              <div key={cat} className={`category ${isOpen ? 'open' : ''}`}>
                <button type="button" className="category-head" onClick={() => toggleCat(cat)}>
                  <div className="category-name">{CATEGORIES[cat] ?? cat}</div>
                  <div className="category-bar">
                    <div className="category-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="category-score">{s.correct}/{s.total}</div>
                  <div className="category-caret">▼</div>
                </button>
                <div className="category-detail">
                  {tags.map(([tag, ts]) => (
                    <div key={tag} className="tag-row">
                      <span className="tag-name">{TAGS[tag]?.name}</span>
                      <span className="tag-score">{ts.correct}/{ts.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="action-bar">
          <button type="button" className="secondary-btn" onClick={onExport}>MDエクスポート</button>
          <button type="button" className="secondary-btn" onClick={onRestart}>もう一度</button>
        </div>
      </div>
    </>
  );
}
