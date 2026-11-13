/* 
 * Copyright (C) 2025-present YouGo (https://github.com/youg-o)
 * This program is licensed under the GNU Affero General Public License v3.0.
 * You may redistribute it and/or modify it under the terms of the license.
 * 
 * Attribution must be given to the original author.
 * This program is distributed without any warranty; see the license for details.
 */

import { coreLog, coreErrorLog } from '../utils/logger';
import { loadExtensionSettings } from '../utils/settings';
import { ExtensionSettings } from '../types/types';
import { PLAYBACK_EVENTS } from '../config/constants';


coreLog('Content script starting to load...');

export let currentSettings: ExtensionSettings | null = null;

let settingsRevision = 0;

function syncPlaybackSettings(): void {
    if (currentSettings) {
        window.dispatchEvent(new Event(currentSettings.playInBackground.enabled
            ? PLAYBACK_EVENTS.enable
            : PLAYBACK_EVENTS.disable));
    }
}

// Synchronize regardless of which execution world finishes loading first.
window.addEventListener(PLAYBACK_EVENTS.ready, syncPlaybackSettings);

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings) {
        initializeFeatures().catch((error) => {
            coreErrorLog('Error updating content script settings:', error);
        });
    }
});

// Initialize features based on settings
async function initializeFeatures() {
    const revision = ++settingsRevision;
    const settings = await loadExtensionSettings();
    // Do not let an older storage read overwrite a more recent update.
    if (revision === settingsRevision) {
        currentSettings = settings;
        syncPlaybackSettings();
    }
}

initializeFeatures().then(() => {
    coreLog('Content script loaded successfully.');
}).catch((error) => {
    coreErrorLog('Error loading content script:', error);
});
