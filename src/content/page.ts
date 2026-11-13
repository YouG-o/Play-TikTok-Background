import { PLAYBACK_EVENTS } from '../config/constants';
import { cleanupBackgroundPlayback, setupBackgroundPlayback } from './backgroundPlayback';
import { setVideoCompletionMode } from './videoCompletion';

// Keep extension APIs in the isolated world; MAIN only receives feature state.
window.addEventListener(PLAYBACK_EVENTS.enable, setupBackgroundPlayback);
window.addEventListener(PLAYBACK_EVENTS.disable, cleanupBackgroundPlayback);
window.addEventListener(PLAYBACK_EVENTS.repeat, () => setVideoCompletionMode('repeat'));
window.addEventListener(PLAYBACK_EVENTS.stop, () => setVideoCompletionMode('stop'));
window.addEventListener(PLAYBACK_EVENTS.next, () => setVideoCompletionMode('next'));
window.dispatchEvent(new Event(PLAYBACK_EVENTS.ready));
