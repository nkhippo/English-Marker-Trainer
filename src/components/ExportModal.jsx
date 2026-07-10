import { useState } from 'react';
import { buildExportMd, downloadMd } from '../utils/exportMd.js';

export default function ExportModal({ set, answers, onClose }) {
  const [copied, setCopied] = useState(false);
  const md = buildExportMd(set, answers);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(md);
    setCopied(true);
  };

  const handleDownload = () => {
    downloadMd(md, `marker-trainer-${set.generatedAt?.slice(0, 10) ?? 'export'}.md`);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-labelledby="export-modal-title">
        <h2 id="export-modal-title" className="modal-title">Claude Projects 貼り付け用</h2>
        <p className="modal-desc">
          全10問の appliedMeaning が含まれています。Claude Projects で意味の妥当性を検証してください。
        </p>
        <textarea className="modal-textarea" readOnly value={md} />
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleDownload}>
            ダウンロード
          </button>
          <button type="button" className="btn-primary btn-primary--compact" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
