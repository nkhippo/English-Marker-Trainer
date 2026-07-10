import { useState, useCallback } from 'react';
import AppShell, { AppHeader, ProgressRail } from './components/AppShell.jsx';
import SetupScreen from './components/SetupScreen.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import QuestionScreen from './components/QuestionScreen.jsx';
import ResultScreen from './components/ResultScreen.jsx';
import ExportModal from './components/ExportModal.jsx';
import { MOCK_SET } from './constants/mockSet.js';
import { DEFAULT_PRESET_ID, getTagsForPreset } from './constants/presets.js';
import { isApiConfigured } from './api/claude.js';
import { generateSet } from './utils/retryLogic.js';
import { shuffleSetOptions } from './utils/shuffleOptions.js';
import './App.css';

function scrollToTop() {
  document.getElementById('app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}

export default function App() {
  const [screen, setScreen] = useState('setup');
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [customTags, setCustomTags] = useState([]);
  const [useMock, setUseMock] = useState(!isApiConfigured());
  const [set, setSet] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [score, setScore] = useState(0);
  const [error, setError] = useState(null);
  const [showExport, setShowExport] = useState(false);

  const apiConfigured = isApiConfigured();

  const resetSession = useCallback(() => {
    setScreen('setup');
    setSet(null);
    setCurrentIdx(0);
    setAnswers([]);
    setReviewed([]);
    setScore(0);
    setError(null);
    scrollToTop();
  }, []);

  const startSession = async () => {
    const selectedTags = getTagsForPreset(presetId, customTags);
    if (!selectedTags.length) return;

    setError(null);
    setScreen('loading');

    try {
      let generated;
      if (useMock || !apiConfigured) {
        await new Promise((r) => setTimeout(r, 600));
        generated = {
          ...MOCK_SET,
          generatedAt: new Date().toISOString(),
          preset: presetId,
          selectedTags,
          items: shuffleSetOptions(MOCK_SET.items),
        };
      } else {
        generated = await generateSet({ presetId, selectedTags });
      }

      setSet(generated);
      setAnswers(new Array(10).fill(null));
      setReviewed(new Array(10).fill(false));
      setCurrentIdx(0);
      setScore(0);
      setScreen('question');
      scrollToTop();
    } catch (e) {
      console.error(e);
      setError(e.message || '生成に失敗しました');
      setScreen('setup');
    }
  };

  const handleSelect = (key) => {
    if (!set || reviewed[currentIdx]) return;

    const item = set.items[currentIdx];
    const picked = item.options.find((o) => o.key === key);

    const nextAnswers = [...answers];
    nextAnswers[currentIdx] = key;
    const nextReviewed = [...reviewed];
    nextReviewed[currentIdx] = true;
    setAnswers(nextAnswers);
    setReviewed(nextReviewed);

    if (picked?.correct) {
      setScore((s) => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIdx === 9) {
      setScreen('result');
    } else {
      setCurrentIdx((i) => i + 1);
    }
    scrollToTop();
  };

  const phase = screen === 'result' ? 2 : screen === 'setup' ? 0 : 1;

  return (
    <AppShell>
      <AppHeader />
      <ProgressRail phase={phase} />

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" className="error-dismiss" onClick={() => setError(null)} aria-label="閉じる">
            ×
          </button>
        </div>
      )}

      {screen === 'setup' && (
        <SetupScreen
          presetId={presetId}
          customTags={customTags}
          onPresetChange={setPresetId}
          onCustomTagsChange={setCustomTags}
          onStart={startSession}
          useMock={useMock}
          onToggleMock={setUseMock}
          apiConfigured={apiConfigured}
        />
      )}

      {screen === 'loading' && <LoadingScreen />}

      {screen === 'question' && set && (
        <QuestionScreen
          item={set.items[currentIdx]}
          index={currentIdx}
          total={10}
          reviewed={reviewed[currentIdx]}
          picked={answers[currentIdx]}
          score={score}
          onSelect={handleSelect}
          onNext={handleNext}
        />
      )}

      {screen === 'result' && set && (
        <ResultScreen
          set={set}
          answers={answers}
          onExport={() => setShowExport(true)}
          onRestart={resetSession}
        />
      )}

      {showExport && set && (
        <ExportModal
          set={set}
          answers={answers}
          onClose={() => setShowExport(false)}
        />
      )}
    </AppShell>
  );
}
