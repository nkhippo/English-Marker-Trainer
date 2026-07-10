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
      <div className="modal">
        <h3>Claude Projects 貼り付け用</h3>
        <p className="modal-desc">
          全10問の appliedMeaning が含まれています。Claude Projects で意味の妥当性を検証してください。
        </p>
        <textarea readOnly value={md} />
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={handleCopy}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button type="button" className="secondary-btn" onClick={handleDownload}>
            ダウンロード
          </button>
          <button type="button" className="secondary-btn" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
