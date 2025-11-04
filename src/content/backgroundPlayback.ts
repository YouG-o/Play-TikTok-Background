/* 
 * Copyright (C) 2025-present YouGo (https://github.com/youg-o)
 * This program is licensed under the GNU Affero General Public License v3.0.
 * You may redistribute it and/or modify it under the terms of the license.
 * 
 * Attribution must be given to the original author.
 * This program is distributed without any warranty; see the license for details.
 */

import { coreLog } from "../utils/logger";


let videoObserver: MutationObserver | null = null;
let videoCheckInterval: number | null = null;

const VIDEO_CHECK_INTERVAL_MS = 500;


/**
 * Find the current TikTok video element
 */
function getCurrentVideo(): HTMLVideoElement | null {
    return document.querySelector('video') || 
           document.querySelector('[data-e2e="video-player"] video');
}


/**
 * Enable background playback for a video element by preventing pause when tab is hidden
 */
function enableBackgroundPlayback(video: HTMLVideoElement): void {
    // Check if already enabled
    if (video.dataset.backgroundPlaybackEnabled === 'true') {
        return;
    }
    
    video.dataset.backgroundPlaybackEnabled = 'true';
    coreLog('Enabling background playback for video element');
    
    // Intercept pause events in capture phase (before TikTok handlers)
    video.addEventListener('pause', function(event: Event) {
        if (document.hidden || !document.hasFocus()) {
            coreLog('Pause event blocked - continuing playback in background');
            event.stopImmediatePropagation(); // Prevent other listeners
            event.preventDefault(); // Prevent default behavior
            
            // Force play immediately
            video.play().catch(err => {
                coreLog(`Error resuming playback: ${err}`);
            });
        }
    }, true); // true = capture phase (priority)
    
    // Override native pause() method
    const originalPause = video.pause;
    video.pause = function() {
        if (document.hidden || !document.hasFocus()) {
            coreLog('Native pause() call blocked - maintaining background playback');
            return; // Do nothing
        }
        // Otherwise, call original pause (e.g., user click)
        return originalPause.apply(this, arguments as any);
    };
    
    coreLog('Background playback successfully enabled');
}


/**
 * Setup mutation observer to detect new video elements
 */
function setupVideoObserver(): void {
    if (videoObserver) {
        videoObserver.disconnect();
    }
    
    // Check if document.body exists
    if (!document.body) {
        coreLog('Document body not ready yet, waiting...');
        return;
    }
    
    coreLog('Setting up video observer for TikTok');
    
    videoObserver = new MutationObserver(() => {
        const video = getCurrentVideo();
        if (video) {
            enableBackgroundPlayback(video);
        }
    });
    
    videoObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}


/**
 * Setup periodic check for video elements
 */
function setupPeriodicVideoCheck(): void {
    if (videoCheckInterval !== null) {
        clearInterval(videoCheckInterval);
    }
    
    coreLog('Setting up periodic video check');
    
    videoCheckInterval = window.setInterval(() => {
        const video = getCurrentVideo();
        if (video && video.dataset.backgroundPlaybackEnabled !== 'true') {
            enableBackgroundPlayback(video);
        }
    }, VIDEO_CHECK_INTERVAL_MS);
}


/**
 * Wait for DOM to be ready before initializing
 */
function waitForDOMReady(): Promise<void> {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            coreLog('DOM not ready, waiting for DOMContentLoaded event');
            document.addEventListener('DOMContentLoaded', () => {
                coreLog('DOMContentLoaded event fired');
                resolve();
            }, { once: true });
        } else {
            coreLog('DOM already ready');
            resolve();
        }
    });
}


/**
 * Initialize background playback feature for TikTok videos
 */
export async function setupBackgroundPlayback(): Promise<void> {
    coreLog('Initializing TikTok background playback');
    
    // Wait for DOM to be ready
    await waitForDOMReady();
    
    // Enable for initial video if present
    const initialVideo = getCurrentVideo();
    if (initialVideo) {
        enableBackgroundPlayback(initialVideo);
    }
    
    // Setup observer for new videos
    setupVideoObserver();
    
    // Setup periodic check as fallback
    setupPeriodicVideoCheck();
    
    coreLog('TikTok background playback fully initialized');
}


/**
 * Cleanup all observers and intervals
 */
export function cleanupBackgroundPlayback(): void {
    coreLog('Cleaning up TikTok background playback');
    
    if (videoObserver) {
        videoObserver.disconnect();
        videoObserver = null;
    }
    
    if (videoCheckInterval !== null) {
        clearInterval(videoCheckInterval);
        videoCheckInterval = null;
    }
}