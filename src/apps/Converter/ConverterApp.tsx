import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useLocalStorageState } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';

type Cat = 'length' | 'weight' | 'temperature' | 'area' | 'volume' | 'speed' | 'time' | 'data' | 'currency' | 'clothing';

const UNITS: Record<Exclude<Cat, 'temperature' | 'currency' | 'clothing'>, Record<string, number>> = {
  length: { Meter: 1, Kilometer: 1000, Centimeter: 0.01, Millimeter: 0.001, Mile: 1609.344, Yard: 0.9144, Foot: 0.3048, Inch: 0.0254, 'Nautical mile': 1852 },
  weight: { Kilogram: 1, Gram: 0.001, Milligram: 0.000001, Pound: 0.45359237, Ounce: 0.028349523, Stone: 6.35029318, Ton: 1000 },
  area: { 'Square meter': 1, 'Square kilometer': 1e6, 'Square foot': 0.09290304, 'Square yard': 0.83612736, Acre: 4046.8564224, Hectare: 10000, 'Square mile': 2589988.11 },
  volume: { Liter: 1, Milliliter: 0.001, 'Cubic meter': 1000, Gallon: 3.785411784, Quart: 0.946352946, Pint: 0.473176473, Cup: 0.2365882365, 'Fluid ounce': 0.0295735296, Tablespoon: 0.0147867648 },
  speed: { 'km/h': 1, 'm/s': 3.6, mph: 1.609344, Knot: 1.852, 'ft/s': 1.09728 },
  time: { Second: 1, Minute: 60, Hour: 3600, Day: 86400, Week: 604800, Month: 2629746, Year: 31556952 },
  data: { Byte: 1, Kilobyte: 1024, Megabyte: 1048576, Gigabyte: 1073741824, Terabyte: 1099511627776, Bit: 0.125, Kibibyte: 1024, Mebibyte: 1048576 },
};

const TEMPS = ['Celsius', 'Fahrenheit', 'Kelvin'];
const CLOTHING = {
  Men: { Shirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], Chest: [34, 36, 38, 40, 42, 44], EU: [44, 46, 48, 50, 52, 54] },
  Women: { Shirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], Chest: [30, 32, 34, 36, 38, 40], EU: [32, 34, 36, 38, 40, 42] },
};
const SHOES = {
  Men: [[6, 39], [7, 40], [8, 41], [9, 42], [10, 43], [11, 44], [12, 45]] as [number, number][],
  Women: [[5, 35], [6, 36], [7, 37], [8, 38], [9, 39], [10, 40]] as [number, number][],
};

const CAT_LABELS: Record<Cat, string> = {
  length: 'Length', weight: 'Weight', temperature: 'Temperature', area: 'Area', volume: 'Volume',
  speed: 'Speed', time: 'Time', data: 'Data size', currency: 'Currency', clothing: 'Clothing',
};

export default function ConverterApp() {
  const [cat, setCat] = useState<Cat>('length');
  const [value, setValue] = useState('1');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rates, setRates] = useLocalStorageState<{ base: string; rates: Record<string, number>; at: number }>('owl:currency-rates', { base: 'USD', rates: {}, at: 0 });
  const [rateState, setRateState] = useState<'idle' | 'loading' | 'ok' | 'cached' | 'error'>('idle');
  const [currencyFrom, setCurrencyFrom] = useState('USD');
  const [currencyTo, setCurrencyTo] = useState('EUR');
  const [tempFrom, setTempFrom] = useState('Celsius');
  const [tempTo, setTempTo] = useState('Fahrenheit');
  const [gender, setGender] = useState<'Men' | 'Women'>('Men');
  const [clothKind, setClothKind] = useState<'Shirt' | 'Shoe'>('Shirt');
  const [clothIndex, setClothIndex] = useState(2);
  const toast = useStore((s) => s.toast);

  const unitList = useMemo(() => {
    if (cat === 'temperature') return TEMPS;
    if (cat === 'currency') return Object.keys(rates.rates).length ? Object.keys(rates.rates) : ['USD', 'EUR', 'GBP', 'EGP', 'SAR', 'AED', 'JPY'];
    if (cat === 'clothing') return [];
    return Object.keys(UNITS[cat]);
  }, [cat, rates]);

  useEffect(() => {
    const list = unitList;
    if (list.length) {
      setFrom(list[0]);
      setTo(list[1] || list[0]);
    }
    setValue('1');
  }, [cat]);

  const fetchRates = async (base = 'USD') => {
    setRateState('loading');
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (data?.result === 'success' && data.rates) {
        setRates({ base, rates: data.rates, at: Date.now() });
        setRateState('ok');
        toast(`Rates updated (${data.rates ? Object.keys(data.rates).length : 0} currencies)`);
      } else {
        throw new Error('bad payload');
      }
    } catch {
      setRateState(Object.keys(rates.rates).length ? 'cached' : 'error');
      if (!Object.keys(rates.rates).length) toast('Could not load exchange rates — cached values unavailable');
    }
  };

  useEffect(() => {
    if (cat === 'currency' && Date.now() - rates.at > 86400000) void fetchRates(rates.base || 'USD');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const swap = () => { setFrom(to); setTo(from); };

  const numeric = Number(value.replace(',', '.'));
  let output = '';
  let formula = '';
  try {
    if (cat === 'temperature') {
      const n = numeric;
      const toC = (v: number, unit: string) => (unit === 'Celsius' ? v : unit === 'Fahrenheit' ? ((v - 32) * 5) / 9 : v - 273.15);
      const fromC = (v: number, unit: string) => (unit === 'Celsius' ? v : unit === 'Fahrenheit' ? (v * 9) / 5 + 32 : v + 273.15);
      const c = toC(n, tempFrom);
      const out = fromC(c, tempTo);
      output = `${round(out)}° ${tempTo[0]}`;
      formula = `${n}° ${tempFrom[0]} → ${output}`;
    } else if (cat === 'currency') {
      const fromRate = rates.rates[currencyFrom] ?? 1;
      const toRate = rates.rates[currencyTo] ?? 1;
      const out = (numeric / fromRate) * toRate;
      output = `${round(out, 4)} ${currencyTo}`;
      formula = rates.at ? `${currencyFrom} → ${currencyTo} · ${new Date(rates.at).toLocaleDateString()}` : 'Rates not loaded';
    } else if (cat === 'clothing') {
      if (clothKind === 'Shirt') {
        const table = CLOTHING[gender];
        const chest = table.Chest[clothIndex];
        const size = table.Shirt[clothIndex];
        const eu = table.EU[clothIndex];
        output = `${size} (EU ${eu})`;
        formula = `${gender} · chest ${chest}" · US ${size} · EU ${eu}`;
      } else {
        const table = SHOES[gender];
        const [us, eu] = table[clothIndex];
        output = `US ${us} = EU ${eu}`;
        formula = `${gender} shoes`;
      }
    } else {
      const table = UNITS[cat];
      const out = (numeric * table[from]) / table[to];
      output = `${round(out)} ${to}`;
      formula = `1 ${from} = ${round(table[from] / table[to])} ${to}`;
    }
  } catch {
    output = '—';
  }

  return (
    <AppFrame
      title="Converter"
      icon="swap"
      actions={<button className="hbtn" onClick={swap}>Swap ⇄</button>}
      menu={[
        { id: 'swap', label: 'Swap units', icon: 'swap', run: swap },
        { id: 'refresh', label: 'Refresh currency rates', icon: 'repeat', run: () => setCat('currency') },
        { id: 'categories', label: 'Next category', icon: 'list', run: () => { const all = Object.keys(CAT_LABELS) as Cat[]; setCat(all[(all.indexOf(cat) + 1) % all.length]); } },
      ]}
    >
      <div className="owlTabBar" style={{ flexWrap: 'wrap' }}>
        {(Object.keys(CAT_LABELS) as Cat[]).map((c) => (
          <button key={c} className={`owlTab ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)} style={{ fontSize: 8.5 }}>
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div className="fieldLabel">Value</div>
        <Field value={value} onChange={setValue} kind="decimal" placeholder="0" autoFocus maxLength={16} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, alignItems: 'end' }}>
          <div>
            <div className="fieldLabel">From</div>
            {cat === 'temperature' ? (
              <select value={tempFrom} onChange={(e) => setTempFrom(e.target.value)} style={selectStyle}>
                {TEMPS.map((t) => <option key={t}>{t}</option>)}
              </select>
            ) : cat === 'currency' ? (
              <select value={currencyFrom} onChange={(e) => setCurrencyFrom(e.target.value)} style={selectStyle}>
                {unitList.map((u) => <option key={u}>{u}</option>)}
              </select>
            ) : cat === 'clothing' ? (
              <select value={String(clothIndex)} onChange={(e) => setClothIndex(Number(e.target.value))} style={selectStyle}>
                {(clothKind === 'Shirt' ? CLOTHING[gender].Shirt : SHOES[gender].map(([us]) => String(us))).map((s, i) => (
                  <option key={i} value={i}>{s}</option>
                ))}
              </select>
            ) : (
              <select value={from} onChange={(e) => setFrom(e.target.value)} style={selectStyle}>
                {unitList.map((u) => <option key={u}>{u}</option>)}
              </select>
            )}
          </div>
          <button className="iconBtn" onClick={swap} aria-label="Swap units" style={{ marginBottom: 2 }}><Icon name="swap" size={11} /></button>
          <div>
            <div className="fieldLabel">To</div>
            {cat === 'temperature' ? (
              <select value={tempTo} onChange={(e) => setTempTo(e.target.value)} style={selectStyle}>
                {TEMPS.map((t) => <option key={t}>{t}</option>)}
              </select>
            ) : cat === 'currency' ? (
              <select value={currencyTo} onChange={(e) => setCurrencyTo(e.target.value)} style={selectStyle}>
                {unitList.map((u) => <option key={u}>{u}</option>)}
              </select>
            ) : (
              <select value={to} onChange={(e) => setTo(e.target.value)} style={selectStyle} disabled={cat === 'clothing'}>
                {cat === 'clothing' ? <option>auto</option> : unitList.map((u) => <option key={u}>{u}</option>)}
              </select>
            )}
          </div>
        </div>

        {cat === 'clothing' && (
          <div className="btnRow" style={{ paddingTop: 2 }}>
            {(['Men', 'Women'] as const).map((g) => (
              <button key={g} className={`chip ${gender === g ? 'on' : ''}`} onClick={() => { setGender(g); setClothIndex(0); }}>{g}</button>
            ))}
            {(['Shirt', 'Shoe'] as const).map((k) => (
              <button key={k} className={`chip ${clothKind === k ? 'on' : ''}`} onClick={() => { setClothKind(k); setClothIndex(0); }}>{k}</button>
            ))}
          </div>
        )}

        <div className="card" style={{ marginTop: 3, textAlign: 'center', background: 'linear-gradient(180deg,var(--panel-2),var(--panel))' }}>
          <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--hl-2)' }}>{output || '—'}</div>
          <div className="tiny">{formula}</div>
        </div>

        {cat === 'currency' && (
          <div className="card tiny" style={{ lineHeight: 1.5 }}>
            Free rates from <b>open.er-api.com</b>. Cached in local storage as a fallback.
            {' '}Status: {rateState === 'loading' ? 'updating…' : rateState === 'error' ? 'offline' : rates.at ? new Date(rates.at).toLocaleString() : 'not loaded'}
            <div style={{ marginTop: 4 }}>
              <button className="btn" style={{ fontSize: 9 }} onClick={() => void fetchRates('USD')}>Refresh rates</button>
            </div>
          </div>
        )}
        {cat === 'data' && <div className="tiny">Binary units (1 KB = 1024 B).</div>}
      </div>
    </AppFrame>
  );
}

function round(n: number, decimals = 6): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** decimals;
  const r = Math.round(n * factor) / factor;
  if (Math.abs(r) >= 1e12) return r.toExponential(4);
  return String(r);
}

const selectStyle: React.CSSProperties = {
  width: '100%', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)',
  borderRadius: 4, padding: '3px 4px', fontSize: 10,
};
