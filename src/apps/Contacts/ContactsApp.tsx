import React, { useMemo, useState } from 'react';
import { useStore } from '../../os/store';
import { useCollection, uid, downloadBlob } from '../../hooks';
import { AppFrame } from '../../components/Shell';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { DB_KEYS } from '../../os/db';
import type { Contact } from '../../os/types';

const SEED: Contact[] = [
  {
    id: 'c-sam', firstName: 'Sam', lastName: 'Rivera', phone: '+1 555 0142', email: 'sam@example.com',
    notes: 'Met at the retro phone meetup.', group: 'Friends', favorite: true, speedDial: 2, createdAt: Date.now() - 86400000 * 12,
  },
  {
    id: 'c-maya', firstName: 'Maya', lastName: 'Haddad', phone: '+20 100 555 8899', email: 'maya@example.com',
    notes: 'Designer — likes owls.', group: 'Work', favorite: false, speedDial: 3, createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: 'c-owl', firstName: 'OWL', lastName: 'Team', phone: '+1 555 0100', email: 'hello@owl.example',
    notes: 'Your friendly phone maker.', group: 'Favorites', favorite: true, speedDial: 1, createdAt: Date.now() - 86400000 * 60,
  },
];

const GROUPS = ['All', 'Favorites', 'Friends', 'Work', 'Family', 'Other'];

export default function ContactsApp() {
  const [contacts, setContacts] = useCollection<Contact>(DB_KEYS.contacts, SEED);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [editing, setEditing] = useState<Contact | null>(null);
  const [viewing, setViewing] = useState<Contact | null>(null);
  const showDialog = useStore((s) => s.showDialog);
  const toast = useStore((s) => s.toast);
  const openApp = useStore((s) => s.openApp);
  const setAppMenu = useStore((s) => s.setAppMenu);

  const filtered = useMemo(() => {
    return contacts
      .filter((c) => {
        if (group === 'Favorites' && !c.favorite) return false;
        if (group !== 'All' && group !== 'Favorites' && c.group !== group) return false;
        if (!query) return true;
        const q = query.toLowerCase();
        return `${c.firstName} ${c.lastName} ${c.phone} ${c.email} ${c.notes}`.toLowerCase().includes(q);
      })
      .sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`));
  }, [contacts, query, group]);

  const save = (c: Contact) => {
    const exists = contacts.some((x) => x.id === c.id);
    setContacts((prev) => (exists ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
    setEditing(null);
    toast(exists ? 'Contact updated' : 'Contact added');
  };

  const remove = (c: Contact) => {
    showDialog({
      title: 'Delete contact?',
      body: `<strong>${c.firstName} ${c.lastName}</strong> will be removed from this device.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { setContacts((prev) => prev.filter((x) => x.id !== c.id)); setViewing(null); toast('Contact deleted'); },
    });
  };

  const exportVcf = () => {
    const vcf = contacts.map((c) => [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${c.lastName};${c.firstName};;;`,
      `FN:${c.firstName} ${c.lastName}`,
      c.phone ? `TEL;TYPE=CELL:${c.phone}` : '',
      c.email ? `EMAIL:${c.email}` : '',
      c.notes ? `NOTE:${c.notes.replace(/\n/g, ' ')}` : '',
      `CATEGORIES:${c.group}`,
      'END:VCARD',
    ].filter(Boolean).join('\r\n')).join('\r\n');
    downloadBlob(new Blob([vcf], { type: 'text/vcard' }), 'owl-contacts.vcf');
    toast(`Exported ${contacts.length} contacts`);
  };

  const importVcf = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcf,text/vcard,text/x-vcard';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const cards = text.split(/BEGIN:VCARD/i).slice(1);
      const parsed: Contact[] = [];
      for (const card of cards) {
        const get = (re: RegExp) => (card.match(re)?.[1] || '').trim();
        const fn = get(/FN[^:]*:(.+)/i);
        const n = get(/\nN[^:]*:(.+)/i);
        const tel = get(/TEL[^:]*:(.+)/i);
        const email = get(/EMAIL[^:]*:(.+)/i);
        const note = get(/NOTE[^:]*:(.+)/i);
        const [last = '', first = ''] = n ? n.split(';') : [];
        if (!fn && !tel) continue;
        parsed.push({
          id: uid('c'),
          firstName: first || fn.split(' ')[0] || 'Unknown',
          lastName: last || fn.split(' ').slice(1).join(' ') || '',
          phone: tel, email, notes: note, group: 'Other', favorite: false, speedDial: null,
          createdAt: Date.now(),
        });
      }
      if (!parsed.length) { toast('No contacts found in that file'); return; }
      setContacts((prev) => [...prev, ...parsed]);
      toast(`Imported ${parsed.length} contact${parsed.length > 1 ? 's' : ''}`);
    };
    input.click();
  };

  React.useEffect(() => {
    setAppMenu({
      title: 'Contacts',
      actions: [
        { id: 'new', label: 'New contact', icon: 'plus', run: () => setEditing(emptyContact()) },
        { id: 'export', label: 'Export vCard (.vcf)', icon: 'download', run: exportVcf },
        { id: 'import', label: 'Import vCard', icon: 'folder', run: importVcf },
        {
          id: 'clear', label: 'Delete all contacts', icon: 'trash', danger: true,
          run: () => showDialog({
            title: 'Delete all contacts?', body: 'This removes every contact stored on this device.',
            confirmLabel: 'Delete all', danger: true, onConfirm: () => { setContacts([]); toast('Contacts cleared'); },
          }),
        },
      ],
    });
    return () => setAppMenu(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length]);

  if (editing) {
    return <ContactEditor contact={editing} onSave={save} onCancel={() => setEditing(null)} />;
  }

  if (viewing) {
    return (
      <AppFrame
        title={`${viewing.firstName} ${viewing.lastName}`}
        icon="contacts"
        actions={<button className="hbtn" onClick={() => setViewing(null)}>Back</button>}
      >
        <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(150deg,var(--panel-3),var(--panel))', display: 'grid', placeItems: 'center', overflow: 'hidden', border: '1px solid var(--line)' }}>
              {viewing.photo ? <img src={viewing.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="contacts" size={22} />}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{viewing.firstName} {viewing.lastName}</div>
              <div className="tiny">{viewing.group}{viewing.speedDial ? ` · speed dial ${viewing.speedDial}` : ''}</div>
              {viewing.favorite && <span className="pill amber">★ Favorite</span>}
            </div>
          </div>
          <div className="card" style={{ display: 'grid', gap: 4 }}>
            {viewing.phone && <div className="kv"><b>Phone</b><span>{viewing.phone}</span></div>}
            {viewing.email && <div className="kv"><b>Email</b><span>{viewing.email}</span></div>}
            {viewing.notes && <div className="kv"><b>Notes</b><span style={{ textAlign: 'right' }}>{viewing.notes}</span></div>}
          </div>
          <div className="btnRow">
            <button className="btn primary" onClick={() => openApp('phone', { number: viewing.phone })}><Icon name="phone" size={10} /> Call</button>
            <button className="btn" onClick={() => openApp('messages', { address: viewing.phone })}><Icon name="message" size={10} /> Message</button>
            <button className="btn" onClick={() => setEditing(viewing)}><Icon name="edit" size={10} /> Edit</button>
            <button className="btn danger" onClick={() => remove(viewing)}><Icon name="trash" size={10} /> Delete</button>
          </div>
        </div>
      </AppFrame>
    );
  }

  return (
    <AppFrame
      title="Contacts"
      icon="contacts"
      actions={
        <>
          <button className="hbtn" onClick={() => setEditing(emptyContact())}><Icon name="plus" size={9} /> New</button>
          <button className="hbtn" onClick={() => setAppMenu({
            title: 'Contacts',
            actions: [
              { id: 'new', label: 'New contact', icon: 'plus', run: () => setEditing(emptyContact()) },
              { id: 'export', label: 'Export vCard (.vcf)', icon: 'download', run: exportVcf },
              { id: 'import', label: 'Import vCard', icon: 'folder', run: importVcf },
              {
                id: 'clear', label: 'Delete all contacts', icon: 'trash', danger: true,
                run: () => showDialog({
                  title: 'Delete all contacts?', body: 'This removes every contact stored on this device.',
                  confirmLabel: 'Delete all', danger: true, onConfirm: () => { setContacts([]); toast('Contacts cleared'); },
                }),
              },
            ],
          })}>Menu</button>
        </>
      }
    >
      <div style={{ padding: 5, display: 'flex', gap: 4 }}>
        <Field value={query} onChange={setQuery} placeholder="Search contacts" autoFocus />
      </div>
      <div className="chipRow" style={{ paddingTop: 0 }}>
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${group === g ? 'on' : ''}`} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="appBody">
        <div className="owlSection">{filtered.length} contact{filtered.length === 1 ? '' : 's'}</div>
        {filtered.length === 0 && (
          <div className="empty"><div className="big">👤</div><div>No contacts match.<br />Add one with the New button.</div></div>
        )}
        {filtered.map((c) => (
          <button key={c.id} className="rowBtn" onClick={() => setViewing(c)}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'var(--panel-2)', flex: 'none' }}>
              {c.photo ? <img src={c.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="contacts" size={12} />}
            </span>
            <span>{c.firstName} {c.lastName}</span>
            {c.favorite && <span style={{ color: 'var(--hl)' }}>★</span>}
            <span className="meta">{c.speedDial ? `SD ${c.speedDial} · ` : ''}{c.phone}</span>
          </button>
        ))}
      </div>
    </AppFrame>
  );
}

function emptyContact(): Contact {
  return {
    id: uid('c'), firstName: '', lastName: '', phone: '', email: '', notes: '',
    group: 'Other', favorite: false, speedDial: null, createdAt: Date.now(),
  };
}

function ContactEditor({ contact, onSave, onCancel }: { contact: Contact; onSave: (c: Contact) => void; onCancel: () => void }) {
  const [c, setC] = useState(contact);
  const toast = useStore((s) => s.toast);
  const set = <K extends keyof Contact>(key: K, value: Contact[K]) => setC((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => set('photo', String(reader.result));
      reader.readAsDataURL(file);
    };
    input.click();
  };

  return (
    <AppFrame title={contact.firstName ? 'Edit contact' : 'New contact'} icon="contacts" actions={<button className="hbtn" onClick={onCancel}>Cancel</button>}>
      <div className="appBody pad" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={pickPhoto} style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--line)', overflow: 'hidden', background: 'var(--panel-2)', cursor: 'pointer', padding: 0 }}>
            {c.photo ? <img src={c.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="camera" size={18} />}
          </button>
          <span className="tiny">Tap to {c.photo ? 'change' : 'add'} photo</span>
        </div>
        <div className="fieldLabel">First name</div>
        <Field value={c.firstName} onChange={(v) => set('firstName', v)} placeholder="First" autoFocus maxLength={30} />
        <div className="fieldLabel">Last name</div>
        <Field value={c.lastName} onChange={(v) => set('lastName', v)} placeholder="Last" maxLength={30} />
        <div className="fieldLabel">Phone</div>
        <Field value={c.phone} onChange={(v) => set('phone', v)} placeholder="+1 555 0100" kind="phone" maxLength={24} />
        <div className="fieldLabel">Email</div>
        <Field value={c.email} onChange={(v) => set('email', v)} placeholder="name@example.com" maxLength={60} />
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <div className="fieldLabel">Group</div>
            <select
              value={c.group}
              onChange={(e) => set('group', e.target.value)}
              style={{ width: '100%', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 4px', fontSize: 10 }}
            >
              {['Friends', 'Work', 'Family', 'Other', 'Favorites'].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ width: 80 }}>
            <div className="fieldLabel">Speed dial</div>
            <select
              value={c.speedDial ?? ''}
              onChange={(e) => set('speedDial', e.target.value ? Number(e.target.value) : null)}
              style={{ width: '100%', background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 4, padding: '3px 4px', fontSize: 10 }}
            >
              <option value="">None</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="fieldLabel">Notes</div>
        <Field value={c.notes} onChange={(v) => set('notes', v)} placeholder="Notes" multiline maxLength={400} />
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button className={`chip ${c.favorite ? 'on' : ''}`} onClick={() => set('favorite', !c.favorite)}>★ Favorite</button>
          <div style={{ flex: 1 }} />
          <button
            className="btn primary"
            onClick={() => {
              if (!c.firstName.trim() && !c.phone.trim()) { toast('Add a name or phone number'); return; }
              onSave({ ...c, firstName: c.firstName.trim() || 'Unknown' });
            }}
          >
            Save
          </button>
        </div>
      </div>
    </AppFrame>
  );
}
