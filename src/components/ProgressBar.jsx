import { TAGS, CATEGORIES } from '../constants/tags.js';

export default function ProgressBar({ current, total, reviewed }) {
  const pct = ((current + (reviewed ? 1 : 0)) / total) * 100;
  return (
    <div className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TagChip({ tagId, sceneTag }) {
  const name = TAGS[tagId]?.name ?? '不明';
  return <span className="tag-chip">{name} · {sceneTag}</span>;
}

export { CATEGORIES };
