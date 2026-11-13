/* 
 * Copyright (C) 2025-present YouGo (https://github.com/youg-o)
 * This program is licensed under the GNU Affero General Public License v3.0.
 * You may redistribute it and/or modify it under the terms of the license.
 * 
 * Attribution must be given to the original author.
 * This program is distributed without any warranty; see the license for details.
 */

import { coreLog } from '../utils/logger';
import { isInViewport } from './video';

let disposePlayback: (() => void) | null = null;

/** Intercept page calls, including videos created later or started in background. */
export function setupBackgroundPlayback(): void {
    if (disposePlayback) {
        return;
    }

    let enabled = true;
    const originalPause = HTMLMediaElement.prototype.pause;
    const interceptedPause = function(this: HTMLMediaElement): void {
        if (enabled && document.hidden && this instanceof HTMLVideoElement &&
            this.isConnected && !this.paused && !this.ended && isInViewport(this)) {
            return;
        }
        originalPause.call(this);
    };

    // A scroll can follow a blocked pause. Stop videos once they leave the
    // viewport so future auto-scroll does not accumulate background players.
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            const video = entry.target as HTMLVideoElement;
            if (!video.isConnected) {
                observer.unobserve(video);
            } else if (enabled && document.hidden && !entry.isIntersecting &&
                !video.paused && !video.ended && !isInViewport(video)) {
                originalPause.call(video);
            }
        }
    });

    const onPlay = (event: Event): void => {
        if (event.target instanceof HTMLVideoElement) {
            observer.observe(event.target);
        }
    };

    HTMLMediaElement.prototype.pause = interceptedPause;
    window.addEventListener('play', onPlay, true);
    document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => observer.observe(video));

    disposePlayback = () => {
        enabled = false;
        observer.disconnect();
        window.removeEventListener('play', onPlay, true);
        // Preserve a method installed by another script after ours.
        if (HTMLMediaElement.prototype.pause === interceptedPause) {
            HTMLMediaElement.prototype.pause = originalPause;
        }
    };

    coreLog('TikTok background playback enabled');
}

/** Restore playback behavior and remove all feature observers and listeners. */
export function cleanupBackgroundPlayback(): void {
    disposePlayback?.();
    disposePlayback = null;
}
