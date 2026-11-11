import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../os/store';
import { GameShell, Overlay, useScores, useGameSfx, useGameKeys } from './gameKit';

type Lang = 'en' | 'ar';

const WORDS: Record<Lang, { word: string; hint: string }[]> = {
  en: [
    { word: 'OWL', hint: 'Night hunter with silent wings' },
    { word: 'NEST', hint: 'Where the babies sleep' },
    { word: 'AMBER', hint: 'The colour of our eyes and buttons' },
    { word: 'FEATHER', hint: 'Light, keeps the cold out' },
    { word: 'TWILIGHT', hint: 'Between day and night' },
    { word: 'MIDNIGHT', hint: 'When the tufted ones hunt' },
    { word: 'MOONLIGHT', hint: 'Silver on the wing' },
    { word: 'KEYBOARD', hint: 'What you are typing on' },
    { word: 'TRACKPAD', hint: 'The square chrome thing' },
    { word: 'SATELLITE', hint: 'Circles the planet' },
    { word: 'TELESCOPE', hint: 'Eye on the stars' },
    { word: 'BARNYARD', hint: 'Farm home of the barn owl' },
    { word: 'WHISPER', hint: 'Quiet as owl flight' },
    { word: 'LANTERN', hint: 'Light in the dark' },
    { word: 'NOCTURNAL', hint: 'Awake at night' },
    { word: 'PIXEL', hint: 'A tiny square of colour' },
    { word: 'CHROME', hint: 'Polished metal trim' },
    { word: 'ANTENNA', hint: 'Grainy TV reception' },
    { word: 'HOOT', hint: 'The owl call' },
    { word: 'GLIDE', hint: 'Fly without flapping' },
  ],
  ar: [
    { word: 'بومة', hint: 'طائر الليل' },
    { word: 'قمر', hint: 'يضيء السماء ليلاً' },
    { word: 'ليل', hint: 'وقت الصيد' },
    { word: 'عش', hint: 'بيت الصغار' },
    { word: 'ريش', hint: 'يغطي الجناح' },
    { word: 'نجمة', hint: 'نقطة مضيئة في السماء' },
    { word: 'صقر', hint: 'طائر جارح' },
    { word: 'غابة', hint: 'أشجار كثيفة' },
    { word: 'شمس', hint: 'تشرق في الصباح' },
    { word: 'ضوء', hint: 'عكس الظلام' },
    { word: 'ساعة', hint: 'لقياس الوقت' },
    { word: 'هاتف', hint: 'جهاز الاتصال' },
    { word: 'لغة', hint: 'العربية مثلاً' },
    { word: 'مدينة', hint: 'مكان مزدحم بالسكان' },
    { word: 'نافذة', hint: 'فتحة للضوء' },
    { word: 'خشب', hint: 'مادة من الأشجار' },
    { word: 'صمت', hint: 'لا صوت' },
    { word: 'زهرة', hint: 'تفتح في الربيع' },
    { word: 'سماء', hint: 'فوقنا' },
    { word: 'ريح', hint: 'هواء متحرك' },
  ],
};

const MAX_GUESSES = 6;
const ALPHABET_EN = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const ALPHABET_AR = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = [...guess];
  const a = [...answer];
  const result: LetterState[] = g.map(() => 'absent');
  const remaining: Record<string, number> = {};
  a.forEach((ch, i) => {
    if (g[i] === ch) result[i] = 'correct';
    else remaining[ch] = (remaining[ch] || 0) + 1;
  });
  g.forEach((ch, i) => {
    if (result[i] === 'correct') return;
    if (remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch] -= 1;
    }
  });
  return result;
}

export default function WordOwlGame() {
  const [lang, setLang] = useState<Lang>('en');
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const { best, submit } = useScores('wordowl');
  const sfx = useGameSfx();
  const toast = useStore((s) => s.toast);
  const startedAt = useRef(Date.now());

  const startNew = useCallback((nextLang = lang, keepStreak = true) => {
    const pool = WORDS[nextLang];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setAnswer(pick.word);
    setHint(pick.hint);
    setGuesses([]);
    setCurrent('');
    setDone(false);
    setWon(false);
    setShowHint(false);
    setSeconds(0);
    startedAt.current = Date.now();
    if (!keepStreak) setStreak(0);
    sfx('flip');
  }, [lang, sfx]);

  useEffect(() => { startNew(lang, true); }, [lang, startNew]);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  const letters = useMemo(() => [...answer], [answer]);
  const width = letters.length;

  const keyStates = useMemo(() => {
    const map: Record<string, LetterState> = {};
    guesses.forEach((guess) => {
      const states = scoreGuess(guess, answer);
      [...guess].forEach((ch, i) => {
        const order: Record<LetterState, number> = { empty: 0, absent: 1, present: 2, correct: 3 };
        if (order[states[i]] > (order[map[ch]] || 0)) map[ch] = states[i];
      });
    });
    return map;
  }, [guesses, answer]);

  const submitGuess = useCallback(() => {
    if (done || !answer) return;
    if ([...current].length !== width) {
      toast(`${width} letters needed`);
      sfx('error');
      return;
    }
    const next = [...guesses, current];
    setGuesses(next);
    setCurrent('');
    if (current === answer) {
      setDone(true);
      setWon(true);
      sfx('win');
      setStreak((s) => s + 1);
      const points = Math.max(50, 600 - (next.length - 1) * 70 + (showHint ? 0 : 80));
      submit(points, `${width} letters · ${next.length}/6`);
      toast('Word owl approves!');
    } else if (next.length >= MAX_GUESSES) {
      setDone(true);
      sfx('die');
      setStreak(0);
      submit(10, 'participation');
    } else {
      sfx('drop');
    }
  }, [current, guesses, answer, width, done, showHint, sfx, submit, toast]);

  const typeLetter = (letter: string) => {
    if (done) return;
    if ([...current].length >= width) return;
    setCurrent((c) => c + letter);
    sfx('click');
  };

  useGameKeys((key, code) => {
    if (key === 'Enter') { if (done) startNew(lang, won); else submitGuess(); return true; }
    if (key === 'Backspace') { setCurrent((c) => [...c].slice(0, -1).join('')); return true; }
    if (lang === 'ar') {
      if (ALPHABET_AR.includes(key)) { typeLetter(key); return true; }
      if (key === 'Delete') { setCurrent(''); return true; }
      return false;
    }
    if (key.length === 1 && /[a-zA-Z]/.test(key)) { typeLetter(key.toUpperCase()); return true; }
    if (code === 'Delete') { setCurrent(''); return true; }
    return false;
  }, [current, done, won, width, lang, submitGuess, startNew]);

  useEffect(() => {
    useStore.getState().setAppMenu({
      title: 'Word Owl',
      actions: [
        { id: 'new', label: 'New word', icon: 'repeat', run: () => startNew(lang, true) },
        { id: 'hint', label: 'Show hint', icon: 'help', run: () => setShowHint(true) },
        { id: 'en', label: 'English words', icon: 'globe', run: () => setLang('en') },
        { id: 'ar', label: 'كلمات عربية', icon: 'globe', run: () => setLang('ar') },
        { id: 'scores', label: 'High scores', icon: 'star', run: () => useStore.getState().openApp('games', { view: 'scores', game: 'wordowl' }) },
      ],
    });
    return () => useStore.getState().setAppMenu(null);
  }, [lang, startNew]);

  const rtl = lang === 'ar';
  const alphabet = rtl ? ALPHABET_AR : ALPHABET_EN;
  const rows = rtl || MAX_GUESSES ? Array.from({ length: MAX_GUESSES }, (_, i) => guesses[i] ?? (i === guesses.length ? current : '')) : [];

  return (
    <GameShell title="WORD OWL" score={`${guesses.length}/6`} best={best} status={done ? (won ? 'Solved!' : `It was ${answer}`) : showHint ? hint : `Streak ${streak}`} onRestart={() => startNew(lang, true)}>
      <div className="gameCanvasWrap" style={{ background: 'linear-gradient(160deg,#0e1b24,#060c12)', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 4 }}>
        <div style={{ display: 'grid', gap: 3, direction: rtl ? 'rtl' : 'ltr' }}>
          {rows.map((word, r) => {
            const lettersRow = [...(word || '')];
            const states = r < guesses.length ? scoreGuess(guesses[r], answer) : [];
            return (
              <div key={r} style={{ display: 'flex', gap: 3 }}>
                {Array.from({ length: width }).map((_, c) => {
                  const ch = lettersRow[c] || '';
                  const state = states[c] || 'empty';
                  const bg = state === 'correct' ? '#2f7a52' : state === 'present' ? '#a3801f' : state === 'absent' ? '#28323b' : 'transparent';
                  return (
                    <div
                      key={c}
                      aria-label={ch || 'empty'}
                      style={{
                        width: width > 8 ? 18 : width > 6 ? 22 : 26, height: width > 8 ? 20 : width > 6 ? 24 : 28,
                        border: `1.5px solid ${ch ? 'rgba(246,185,63,.65)' : 'rgba(160,190,210,.25)'}`,
                        background: bg, color: state === 'empty' ? '#eaf2f8' : '#fff', borderRadius: 3,
                        display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700,
                        fontSize: width > 8 ? 10 : width > 6 ? 12 : 14, textTransform: rtl ? 'none' : 'uppercase',
                      }}
                    >
                      {ch}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', maxWidth: 320 }}>
          {[...alphabet].map((letter) => {
            const state = keyStates[letter] || 'empty';
            return (
              <button
                key={letter}
                onClick={() => typeLetter(letter)}
                className="btn"
                style={{
                  minWidth: 17, height: 19, padding: '0 2px', fontSize: 8.5,
                  background: state === 'correct' ? '#2f7a52' : state === 'present' ? '#a3801f' : state === 'absent' ? '#28323b' : undefined,
                  color: state === 'absent' ? '#7f8f9c' : undefined,
                }}
                aria-label={`Letter ${letter}${state !== 'empty' ? ` — ${state}` : ''}`}
              >
                {letter}
              </button>
            );
          })}
          <button className="btn" onClick={submitGuess} style={{ height: 19, fontSize: 8.5, padding: '0 5px' }}>Enter</button>
          <button className="btn" onClick={() => setCurrent((c) => [...c].slice(0, -1).join(''))} style={{ height: 19, fontSize: 8.5, padding: '0 5px' }}>⌫</button>
        </div>
        {done && (
          <Overlay>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{won ? 'WORD OWL APPROVES' : 'OUT OF GUESSES'}</div>
            <div className="tiny">Answer: <b>{answer}</b> · {hint}</div>
            <div className="tiny">Streak {streak} · Best {best}</div>
            <button className="btn primary" onClick={() => startNew(lang, won)}>{won ? 'Next word' : 'Try another'}</button>
          </Overlay>
        )}
      </div>
      <div style={{ padding: '2px 6px', display: 'flex', gap: 3, alignItems: 'center' }}>
        <button className={`chip ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>English</button>
        <button className={`chip ${lang === 'ar' ? 'on' : ''}`} onClick={() => setLang('ar')}>عربي</button>
        <button className="chip" onClick={() => setShowHint(true)}>Hint</button>
        <span className="tiny" style={{ marginLeft: 'auto' }}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · {width} letters</span>
      </div>
    </GameShell>
  );
}
