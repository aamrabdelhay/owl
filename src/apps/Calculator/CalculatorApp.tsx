import React, { useEffect, useState } from 'react';
import { useStore } from '../../os/store';
import { useLocalStorageState } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Icon } from '../../components/Icon';
import { evaluate, formatResult } from '../../os/expr';
import { registerAppKeys } from '../../os/kernel';
import { errorBuzz } from '../../os/audio';

const BASIC = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];

const SCI = [
  ['sin', 'cos', 'tan', 'π'],
  ['√', 'x²', 'xʸ', 'e'],
  ['(', ')', 'ln', 'log'],
];

export default function CalculatorApp() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');
  const [memory, setMemory] = useState(0);
  const [sci, setSci] = useState(false);
  const [history, setHistory] = useLocalStorageState<{ expr: string; result: string }[]>('owl:calc-history', []);
  const [justSolved, setJustSolved] = useState(false);
  const toast = useStore((s) => s.toast);

  const normalize = (input: string) =>
    input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/x²/g, '^2').replace(/xʸ/g, '^');

  const compute = () => {
    if (!expr.trim()) return;
    try {
      const value = evaluate(normalize(expr));
      const formatted = formatResult(value);
      setResult(formatted);
      setHistory((prev) => [{ expr, result: formatted }, ...prev].slice(0, 25));
      setJustSolved(true);
    } catch (err: any) {
      setResult('Error');
      errorBuzz();
      toast(err?.message || 'Invalid expression');
      setJustSolved(true);
    }
  };

  const insert = (token: string) => {
    if (justSolved && /[0-9.]/.test(token)) {
      setExpr(token);
      setJustSolved(false);
      return;
    }
    if (justSolved && /[+\-*/^%×÷−]/.test(token)) {
      setExpr((prev) => `${prev || result}${token}`);
      setJustSolved(false);
      return;
    }
    setJustSolved(false);
    if (token === 'sin' || token === 'cos' || token === 'tan' || token === 'ln' || token === 'log' || token === '√') {
      setExpr((prev) => `${prev}${token}(`);
      return;
    }
    if (token === 'π') { setExpr((prev) => `${prev}π`); return; }
    if (token === 'x²') { setExpr((prev) => `${prev}^2`); return; }
    if (token === 'xʸ') { setExpr((prev) => `${prev}^`); return; }
    setExpr((prev) => prev + token);
  };

  const press = (key: string) => {
    switch (key) {
      case 'C': setExpr(''); setResult(''); setJustSolved(false); break;
      case '⌫': setExpr((p) => p.slice(0, -1)); break;
      case '=': compute(); break;
      case '±': setExpr((p) => (p.startsWith('-') ? p.slice(1) : `-${p}`)); break;
      case '%': setExpr((p) => `${p}%`); break;
      default: insert(key); break;
    }
  };

  useEffect(() => {
    const off = registerAppKeys((e) => {
      if (useStore.getState().activeFieldId) return false;
      if (/^[0-9.]$/.test(e.key)) { insert(e.key); return true; }
      if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/' || e.key === '^' || e.key === '(' || e.key === ')' || e.key === '%') {
        insert(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key === '-' ? '−' : e.key);
        return true;
      }
      if (e.key === 'Enter') { compute(); return true; }
      if (e.key === 'Backspace') { setExpr((p) => p.slice(0, -1)); return true; }
      return false;
    });
    return off;
  });

  return (
    <AppFrame
      title="Calculator"
      icon="calc"
      actions={
        <>
          <button className="hbtn" onClick={() => setSci((v) => !v)}>{sci ? 'Basic' : 'Scientific'}</button>
          <button className="hbtn" onClick={() => { setExpr(''); setResult(''); setHistory([]); }}>Clear hist.</button>
        </>
      }
    >
      <div style={{ padding: '4px 7px', borderBottom: '1px solid var(--line)', background: 'rgba(0,0,0,.22)' }}>
        <div className="tiny" style={{ minHeight: 12, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr' }}>
          {memory !== 0 && <span className="pill amber" style={{ marginRight: 4 }}>M {memory}</span>}
          {expr || <span style={{ opacity: 0.4 }}>0</span>}
        </div>
        <div className="mono" style={{ fontSize: 22, fontWeight: 700, textAlign: 'right', fontFamily: 'var(--font-display)', minHeight: 26, direction: 'ltr' }}>
          {result || '\u00a0'}
        </div>
      </div>
      <div className="appBody" style={{ display: 'flex', flexDirection: 'column' }}>
        {sci && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, padding: 3 }}>
            {SCI.flat().map((k) => (
              <button key={k} className="btn" style={{ fontSize: 9.5, minHeight: 20 }} onClick={() => press(k)}>{k}</button>
            ))}
            <button className="btn" style={{ fontSize: 9 }} onClick={() => setMemory(Number(result) || memory)}>MS</button>
            <button className="btn" style={{ fontSize: 9 }} onClick={() => insert(String(memory))}>MR</button>
            <button className="btn" style={{ fontSize: 9 }} onClick={() => setMemory((m) => m + (Number(result) || 0))}>M+</button>
            <button className="btn" style={{ fontSize: 9 }} onClick={() => { setMemory(0); toast('Memory cleared'); }}>MC</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, padding: 4, flex: 1 }}>
          {BASIC.flat().map((key) => (
            <button
              key={key}
              className={`calcKey ${key === '=' ? 'eq' : ''} ${/[÷×−+%]/.test(key) ? 'op' : ''}`}
              onClick={() => press(key)}
              aria-label={key === '⌫' ? 'Backspace' : key}
              style={{
                borderRadius: 5, border: '1px solid var(--line)', cursor: 'pointer', fontSize: key === '⌫' ? 13 : 16,
                fontFamily: 'var(--font-display)', fontWeight: 600,
                background: key === '=' ? 'linear-gradient(180deg,var(--hl-2),var(--hl))' : /[÷×−+%C±]/.test(key) ? 'var(--panel-3)' : 'var(--panel-2)',
                color: key === '=' ? 'var(--hl-text)' : 'var(--text)',
                minHeight: 26,
              }}
            >{key}</button>
          ))}
        </div>
        {history.length > 0 && (
          <div style={{ maxHeight: 52, overflow: 'auto', borderTop: '1px solid var(--line)' }}>
            {history.slice(0, 8).map((h, i) => (
              <button
                key={i}
                className="rowBtn"
                style={{ padding: '1px 7px', minHeight: 16 }}
                onClick={() => { setExpr(h.result); setJustSolved(true); }}
                title="Use this result"
              >
                <span className="tiny" style={{ flex: 1, textAlign: 'left' }}>{h.expr}</span>
                <span className="tiny mono">= {h.result}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
