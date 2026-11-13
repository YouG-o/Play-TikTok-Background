import { PLAYBACK_EVENTS } from '../config/constants';
import { cleanupBackgroundPlayback, setupBackgroundPlayback } from './backgroundPlayback';

// Keep extension APIs in the isolated world; MAIN only receives feature state.
window.addEventListener(PLAYBACK_EVENTS.enable, setupBackgroundPlayback);
window.addEventListener(PLAYBACK_EVENTS.disable, cleanupBackgroundPlayback);
window.dispatchEvent(new Event(PLAYBACK_EVENTS.ready));
