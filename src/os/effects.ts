import { useEffect } from 'react';
import { useStore } from './store';
import { loadKey } from './db';
import { DB_KEYS } from './db';
import type { Alarm, CalEvent } from './types';
import { playRingtone, stopRingtone, messageTone, vibrate } from './audio';

/**
 * Background OS services: clock tick, alarm checks, calendar reminders,
 * simulated incoming SMS. These run while the phone is on, across apps —
 * like a real handset.
 */
export function useEffects() {
  useEffect(() => {
    const clock = window.setInterval(() => useStore.getState().tickClock(), 1000);

    /* ---------------- alarms ---------------- */
    let lastAlarmMinute = '';
    const alarmTimer = window.setInterval(async () => {
      const s = useStore.getState();
      if (!s.powered || s.booting || s.alarmRinging) return;
      const alarms = await loadKey<Alarm[]>(DB_KEYS.alarms, []);
      const now = new Date();
      const key = `${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      if (lastAlarmMinute === key) return;
      const due = alarms.find(
        (a) => a.enabled && a.hour === now.getHours() && a.minute === now.getMinutes()
        && (a.days.length === 0 || a.days.includes(now.getDay()))
      );
      if (due) {
        lastAlarmMinute = key;
        s.setAlarmRinging(due.label || 'Alarm');
        if (s.settings.profile === 'silent') {
          s.toast('Alarm (silent profile)');
        }
      }
    }, 15000);

    /* ---------------- calendar reminders ---------------- */
    const notified = new Set<string>();
    const reminderTimer = window.setInterval(async () => {
      const s = useStore.getState();
      if (!s.powered || s.booting) return;
      const events = await loadKey<CalEvent[]>(DB_KEYS.events, []);
      const now = Date.now();
      for (const e of events) {
        if (e.reminderMinutes === null || e.reminderMinutes === undefined) continue;
        const trigger = e.start - e.reminderMinutes * 60000;
        if (now >= trigger && now - trigger < 90000 && !notified.has(`${e.id}:${e.start}`)) {
          notified.add(`${e.id}:${e.start}`);
          s.notify(`Reminder: ${e.title}`, 'calendar');
          break;
        }
      }
      void s.refreshCounters();
    }, 30000);

    /* ---------------- simulated incoming SMS ---------------- */
    const smsTimer = window.setTimeout(async () => {
      const s = useStore.getState();
      if (!s.settings.onboarded || !s.powered) return;
      if (localStorage.getItem('owl:nudge-sent')) return;
      localStorage.setItem('owl:nudge-sent', '1');
      const messages = await loadKey<any[]>(DB_KEYS.smsMessages, []);
      const threads = await loadKey<any[]>(DB_KEYS.smsThreads, []);
      const welcome = threads.find((t) => t.address === 'OWL');
      if (!welcome || !messages.length) return;
      s.notify('New message from Owl Team');
    }, 45000);

    /* ---------------- low battery ---------------- */
    let warned = false;
    const unsub = useStore.subscribe((state) => {
      if (!warned && state.battery.level < 0.12 && !state.battery.charging) {
        warned = true;
        state.toast('Battery low — power saver recommended');
      }
      if (state.battery.level > 0.3) warned = false;
    });

    return () => {
      window.clearInterval(clock);
      window.clearInterval(alarmTimer);
      window.clearInterval(reminderTimer);
      window.clearTimeout(smsTimer);
      unsub();
      stopRingtone();
    };
  }, []);

  /* preview the chosen ringtone when the user changes it in settings */
  useEffect(() => {
    let stop: (() => void) | null = null;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.settings.ringtone !== prev.settings.ringtone) {
        stop?.();
        stop = playRingtone(state.settings.ringtone, state.settings.ringVolume, 1);
      }
      if (state.settings.messageTone !== prev.settings.messageTone) {
        messageTone(state.settings.messageTone, state.settings.volume);
      }
      if (state.settings.profile !== prev.settings.profile) {
        if (state.settings.profile === 'silent') {
          stopRingtone();
          state.toast('Silent profile');
        } else if (state.settings.profile === 'vibrate') {
          state.toast('Vibrate profile');
          if (state.settings.vibrate) vibrate([200, 100, 200]);
        } else {
          state.toast(`${state.settings.profile} profile`);
        }
      }
    });
    return () => {
      unsub();
      stop?.();
    };
  }, []);
}
