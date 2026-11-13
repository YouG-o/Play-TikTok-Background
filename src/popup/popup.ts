/* 
 * Copyright (C) 2025-present YouGo (https://github.com/youg-o)
 * This program is licensed under the GNU Affero General Public License v3.0.
 * You may redistribute it and/or modify it under the terms of the license.
 * 
 * Attribution must be given to the original author.
 * This program is distributed without any warranty; see the license for details.
 */

import { ExtensionSettings } from '../types/types';
import { loadExtensionSettings, saveExtensionSettings } from '../utils/settings';
import { renderPlaybackControls } from './playbackControls';

/**
 * This file handles the popup UI interactions and saves settings to storage
 */

// DOM Elements
const controls = renderPlaybackControls();
let currentSettings: ExtensionSettings;
let settingsRevision = 0;
let pendingSaves = 0;
let saveQueue: Promise<void> = Promise.resolve();
const extensionVersionElement = document.getElementById('extensionVersion') as HTMLSpanElement;

/**
 * Display the extension version in the popup.
 */
function displayExtensionVersion() {
    if (extensionVersionElement) {
        const manifest = browser.runtime.getManifest();
        extensionVersionElement.textContent = manifest.version;
    }
}

/**
 * Load saved settings from storage and update the UI.
 */
async function loadSettings() {
    const revision = ++settingsRevision;
    try {
        const settings = await loadExtensionSettings();
        if (revision !== settingsRevision) return;
        currentSettings = settings;
        for (const key of Object.keys(controls) as (keyof ExtensionSettings)[]) {
            controls[key].checked = currentSettings[key].enabled;
            controls[key].disabled = false;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Save the current settings to storage.
 */
async function saveSettings(changedFeature: keyof ExtensionSettings) {
    ++settingsRevision;
    if (changedFeature === 'autoScroll' && controls.autoScroll.checked) controls.preventRepeat.checked = false;
    if (changedFeature === 'preventRepeat' && controls.preventRepeat.checked) controls.autoScroll.checked = false;
    const settings: ExtensionSettings = {
        ...currentSettings,
        playInBackground: {
            enabled: controls.playInBackground.checked
        },
        preventRepeat: { enabled: controls.preventRepeat.checked },
        autoScroll: { enabled: controls.autoScroll.checked }
    };
    currentSettings = settings;
    pendingSaves++;
    // Preserve the order of rapid changes, including switches between modes.
    saveQueue = saveQueue.catch(() => {}).then(() => saveExtensionSettings(settings));
    try {
        await saveQueue;
    } catch (error) {
        console.error('Failed to save settings:', error);
    } finally {
        if (--pendingSaves === 0) await loadSettings();
    }
}

/**
 * Initialize event listeners for the popup.
 */
function initEventListeners() {
    for (const key of Object.keys(controls) as (keyof ExtensionSettings)[]) {
        controls[key].addEventListener('change', () => saveSettings(key));
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    displayExtensionVersion();
    loadSettings();
    initEventListeners();
});

browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.settings && pendingSaves === 0) loadSettings();
});


// Check if this is a welcome page (first install)
const urlParams = new URLSearchParams(window.location.search);
const isWelcome = urlParams.get('welcome') === 'true';

if (isWelcome) {
    const pageTitle = document.getElementById('pageTitle');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (pageTitle) {
        // Keep the image and change only the text part
        const imgElement = pageTitle.querySelector('img');
        if (imgElement) {
            pageTitle.innerHTML = '';
            pageTitle.appendChild(imgElement);
            pageTitle.appendChild(document.createTextNode(`Welcome to Play TikTok Background!`));
        }
    }
    
    if (welcomeMessage) {
        welcomeMessage.classList.remove('hidden');
    }
}


// Handle reload of all TikTok tabs from the welcome page
if (isWelcome) {
    const reloadBtn = document.getElementById('reloadTikTokTabsBtn') as HTMLButtonElement | null;
    if (reloadBtn) {
        reloadBtn.onclick = async () => {
            try {
                const tabs = await browser.tabs.query({
                    url: [
                        "*://*.tiktok.com/*"
                    ]
                });
                let count = 0;
                for (const tab of tabs) {
                    // Only reload tabs that are not discarded
                    if (tab.id && tab.discarded === false) {
                        await browser.tabs.reload(tab.id);
                        count++;
                    }
                }
                reloadBtn.textContent = `Reloaded ${count} active tab${count !== 1 ? 's' : ''}!`;
                reloadBtn.disabled = true;
            } catch (error) {
                reloadBtn.textContent = "Error reloading tabs";
                reloadBtn.disabled = true;
                console.error("[PTB] Failed to reload TikTok tabs:", error);
            }
        };
    }
}
