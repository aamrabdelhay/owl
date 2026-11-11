import { useStore } from './store';

/** Opens the setup wizard once for brand-new installs (after the boot screen). */
export function openSetupIfNeeded() {
  const state = useStore.getState();
  if (state.settings.onboarded) return;
  if (state.screen !== 'home') return;
  state.openApp('setup');
}
