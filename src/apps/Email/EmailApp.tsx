import React, { useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import type { Contact } from '../../os/types';
import { DB_KEYS } from '../../os/db';

/**
 * Local mail composer. There is no mail server: the composer hands the filled
 * message to the device's own mail client via a mailto: link.
 */
export default function EmailApp() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState<{ to: string; subject: string; at: number }[]>([]);
  const [contacts] = useCollection<Contact>(DB_KEYS.contacts, []);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const open = () => {
    if (!to.trim()) { toast('Add at least one recipient'); return; }
    showDialog({
      title: 'Open mail app?',
      body: `OWL has no mail server. This opens <strong>${to}</strong> in your device's mail client with the message prefilled.`,
      confirmLabel: 'Open mail app',
      onConfirm: () => {
        window.location.href = mailto;
        setSent((prev) => [{ to, subject: subject || '(no subject)', at: Date.now() }, ...prev].slice(0, 10));
        toast('Handed off to your mail app');
      },
    });
  };

  return (
    <AppFrame
      title="Email"
      icon="mail"
      actions={<button className="hbtn" onClick={open}><Icon name="send" size={9} /> Send</button>}
      menu={[
        { id: 'send', label: 'Open mail app', icon: 'send', run: open },
        { id: 'clear', label: 'Clear draft', icon: 'trash', run: () => { setTo(''); setSubject(''); setBody(''); } },
        { id: 'contacts', label: 'Pick a contact', icon: 'contacts', run: () => useStore.getState().openApp('contacts') },
      ]}
    >
      <div className="appBody" style={{ padding: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div className="tiny" style={{ lineHeight: 1.4 }}>
          Local composer — nothing is uploaded. Sending opens your own mail app with a <b>mailto:</b> link.
        </div>
        <div className="fieldLabel">To</div>
        <Field
          value={to}
          onChange={setTo}
          placeholder="name@example.com"
          autoFocus
          maxLength={120}
          onMove={(dir) => (dir === 'down' ? (useStore.getState().focusField('email-subject'), true) : false)}
        />
        <div className="chipRow" style={{ padding: '2px 0' }}>
          {contacts.filter((c) => c.email).slice(0, 4).map((c) => (
            <button key={c.id} className="chip" onClick={() => setTo((t) => (t ? `${t}, ${c.email}` : c.email))}>
              {c.firstName}
            </button>
          ))}
        </div>
        <div className="fieldLabel">Subject</div>
        <Field value={subject} onChange={setSubject} placeholder="Subject" maxLength={140} autoFocus={false} />
        <div className="fieldLabel">Message</div>
        <Field value={body} onChange={setBody} placeholder="Write your email…" multiline maxLength={4000} />
        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn" onClick={() => { setTo(''); setSubject(''); setBody(''); }}>Clear</button>
          <button className="btn primary" onClick={open}><Icon name="send" size={10} /> Compose</button>
        </div>

        {sent.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <div className="owlSection">Handed off recently</div>
            {sent.map((s, i) => (
              <div key={i} className="rowBtn" style={{ cursor: 'default' }}>
                <Icon name="mail" size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.subject}</span>
                <span className="meta">{s.to}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppFrame>
  );
}
