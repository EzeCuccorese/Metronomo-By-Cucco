import { useRegisterSW } from 'virtual:pwa-register/react';
import { UpdatePrompt } from './UpdatePrompt';

/** Registers the service worker (`registerType: 'prompt'`) and offers new versions once playback stops. */
export function PwaUpdater({ isPlaying }: { isPlaying: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Long-lived tabs (an installed PWA stays open for days) check for a new version every hour.
      if (registration) setInterval(() => { void registration.update(); }, 60 * 60 * 1000);
    },
  });

  return (
    <UpdatePrompt
      needRefresh={needRefresh}
      isPlaying={isPlaying}
      onUpdate={() => { void updateServiceWorker(true); }}
      onDismiss={() => setNeedRefresh(false)}
    />
  );
}
