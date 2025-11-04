/* 
 * Copyright (C) 2025-present YouGo (https://github.com/youg-o)
 * This program is licensed under the GNU Affero General Public License v3.0.
 * You may redistribute it and/or modify it under the terms of the license.
 * 
 * Attribution must be given to the original author.
 * This program is distributed without any warranty; see the license for details.
 */

import { ExtensionSettings } from '../types/types';
import { loadExtensionSettings } from '../utils/settings';

/**
 * This file handles the popup UI interactions and saves settings to storage
 */

// DOM Elements
const playInBackgroundFeature = document.getElementById('playInBackgroundFeature') as HTMLInputElement;
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
    try {
        const settings = await loadExtensionSettings();
        if (settings.playInBackground) {
            playInBackgroundFeature.checked = settings.playInBackground.enabled;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

/**
 * Save the current settings to storage.
 */
async function saveSettings() {
    const settings: ExtensionSettings = {
        playInBackground: {
            enabled: playInBackgroundFeature.checked
        }
    };
    try {
        await browser.storage.local.set({ settings });
        updateActiveTabs(settings);
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

/**
 * Update all active TikTok tabs with new settings.
 */
async function updateActiveTabs(settings: ExtensionSettings) {
    const tabs = await browser.tabs.query({ url: '*://*.tiktok.com/*' });
    for (const tab of tabs) {
        if (tab.id) {
            browser.tabs.sendMessage(tab.id, {
                action: 'updateSettings',
                settings: settings
            }).catch((error: unknown) => {
                console.error(`Failed to update tab ${tab.id}:`, error);
            });
        }
    }
}

/**
 * Initialize event listeners for the popup.
 */
function initEventListeners() {
    playInBackgroundFeature.addEventListener('change', saveSettings);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    displayExtensionVersion();
    loadSettings();
    initEventListeners();
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