import React, { useState } from 'react';
import { useStore } from '../../os/store';
import { AppFrame } from '../../components/Shell';
import { OwlLogo } from '../../components/OwlLogo';
import { Field } from '../../components/Field';
import { WALLPAPERS } from '../../assets/wallpapers';
import { hashPassword, randomSalt } from '../../os/security';
import { successChime } from '../../os/audio';
import { Icon } from '../../components/Icon';

const STEPS = ['Welcome', 'Language', 'Your name', 'Wallpaper', 'Password', 'Done'];

export default function SetupApp() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const closeApp = useStore((s) => s.closeApp);
  const toast = useStore((s) => s.toast);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.userName);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [wp, setWp] = useState(settings.wallpaperId);
  const [error, setError] = useState('');

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finishPassword = async () => {
    if (!pass) { next(); return; }
    if (pass.length < 4) { setError('Use at least 4 characters'); return; }
    if (pass !== pass2) { setError('Passwords do not match'); return; }
    const salt = randomSalt();
    const hash = await hashPassword(pass, salt);
    updateSettings({ passwordHash: hash, passwordSalt: salt, passwordIsPin: /^\d+$/.test(pass) });
    setError('');
    next();
  };

  return (
    <AppFrame
      title="Setup Wizard"
      icon="wand"
      actions={<span className="tiny">{step + 1}/{STEPS.length}</span>}
      menu={[
        { id: 'next', label: 'Next step', icon: 'arrowRight', run: next },
        { id: 'back', label: 'Previous step', icon: 'arrowLeft', run: back },
        { id: 'skip', label: 'Skip to the end', icon: 'check', run: () => setStep(STEPS.length - 1) },
      ]}
    >
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--hl)' : 'var(--line)' }} />
          ))}
        </div>

        {step === 0 && (
          <div style={{ textAlign: 'center', padding: '6px 4px', display: 'grid', gap: 6, placeItems: 'center' }}>
            <OwlLogo size={54} glow />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.28em' }}>OWL</div>
            <div className="tiny" style={{ maxWidth: 300, lineHeight: 1.5 }}>
              Welcome to your new phone. This wizard sets up language, wallpaper and an optional
              lock password. Everything is stored on this device only.
            </div>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="fieldLabel">Language / اللغة</div>
            {([['en', 'English', 'Left to right'], ['ar', 'العربية', 'من اليمين إلى اليسار (RTL)']] as const).map(([code, label, hint]) => (
              <button
                key={code}
                className="rowBtn"
                onClick={() => updateSettings({ language: code })}
                style={{ border: settings.language === code ? '1px solid var(--hl)' : undefined, borderRadius: 5 }}
              >
                <span>{label}</span>
                <span className="meta">{hint}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="fieldLabel">What should the phone call you?</div>
            <Field value={name} onChange={setName} placeholder="Your name" autoFocus maxLength={24} onSubmit={next} />
            <div className="tiny" style={{ marginTop: 4 }}>Shown on the home screen. Optional.</div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="fieldLabel">Pick a wallpaper</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {WALLPAPERS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWp(w.id)}
                  aria-label={w.name}
                  style={{
                    height: 42, borderRadius: 5, border: wp === w.id ? '2px solid var(--hl)' : '1px solid var(--line)',
                    backgroundImage: w.css, backgroundSize: 'cover', cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
            <div className="tiny" style={{ marginTop: 4 }}>You can add your own photo later in Settings › Wallpaper.</div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'grid', gap: 4 }}>
            <div className="fieldLabel">Lock password (optional)</div>
            <Field value={pass} onChange={setPass} kind="password" placeholder="Password or PIN (4–12)" maxLength={12} autoFocus />
            <Field value={pass2} onChange={setPass2} kind="password" placeholder="Repeat password" maxLength={12} onSubmit={() => void finishPassword()} />
            {error && <div className="tiny" style={{ color: 'var(--red)' }}>{error}</div>}
            <div className="tiny">Stored as a salted PBKDF2 hash — never as plain text. You can remove it any time.</div>
          </div>
        )}

        {step === 5 && (
          <div style={{ textAlign: 'center', display: 'grid', gap: 5, placeItems: 'center' }}>
            <div style={{ fontSize: 26 }}>✓</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>You're all set{name ? `, ${name}` : ''}.</div>
            <div className="tiny" style={{ maxWidth: 300 }}>
              Hold <b>Menu</b> for recent apps. Type any letter on the home screen to search.
              Press <b>Esc</b> to go back, <b>F1</b> for the menu.
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', gap: 5 }}>
          {step > 0 && step < 5 && <button className="btn" onClick={back}>Back</button>}
          <div style={{ flex: 1 }} />
          {step < 4 && <button className="btn primary" onClick={() => { updateSettings({ wallpaperId: wp }); next(); }}>Next</button>}
          {step === 4 && (
            <button className="btn primary" onClick={() => void finishPassword()}>
              {pass ? 'Set password' : 'Skip'}
            </button>
          )}
          {step === 5 && (
            <button
              className="btn primary"
              onClick={() => {
                updateSettings({ onboarded: true, userName: name, wallpaperId: wp });
                successChime();
                toast('Welcome to OWL');
                closeApp();
              }}
            >
              Start using OWL
            </button>
          )}
        </div>
        {step === 5 && (
          <button className="btn" onClick={() => closeApp()} style={{ fontSize: 9 }}>
            <Icon name="back" size={9} /> Go to home screen
          </button>
        )}
      </div>
    </AppFrame>
  );
}
