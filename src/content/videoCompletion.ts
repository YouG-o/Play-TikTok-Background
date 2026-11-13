import { VideoCompletionMode } from '../types/types';
import { coreLog } from '../utils/logger';
import { isInViewport } from './video';
import { tryNativeNextVideo } from './nativeNavigation';

let mode: VideoCompletionMode = 'repeat';
let disposeCompletion: (() => void) | null = null;

/** Prefer TikTok's navigation so its player state follows the transition. */
function goToNextVideo(video: HTMLVideoElement): void {
    // Native animation frames can be suspended while TikTok is in the background.
    const useInstantNavigation = document.hidden || !document.hasFocus();
    if (!useInstantNavigation && tryNativeNextVideo(video)) return;

    // The button also starts the native animation, so bypass it in background.
    if (!useInstantNavigation) {
        const buttons = document.querySelectorAll<HTMLElement>(
            '[data-e2e="feed-navigation-next"], [data-e2e="arrow-right"], [data-e2e="browse-video-next"], button[aria-label="Next video"]'
        );
        const button = Array.from(buttons)
            .map((element) => element.closest<HTMLElement>('button') ?? element)
            .find((element) => typeof element.click === 'function' && isInViewport(element) &&
                !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true');
        if (button) {
            button.click();
            return;
        }
    }

    // Feed layouts may have no navigation button. Scroll the next feed card.
    const cardSelector = 'article, [data-e2e="recommend-list-item-container"]';
    const currentCard = video.closest(cardSelector);
    if (currentCard) {
        const cards = Array.from(document.querySelectorAll<HTMLElement>(cardSelector));
        const currentIndex = cards.indexOf(currentCard as HTMLElement);
        const nextCard = cards.slice(currentIndex + 1).find((card) => !currentCard.contains(card));
        if (nextCard) {
            nextCard.scrollIntoView({ block: 'center', behavior: 'instant' });
            return;
        }
    }
    coreLog('No next video navigation available');
}

/** Both optional modes share loop management and the native ended event. */
export function setVideoCompletionMode(nextMode: VideoCompletionMode): void {
    mode = nextMode;
    if (mode === 'repeat') {
        disposeCompletion?.();
        disposeCompletion = null;
        return;
    }
    if (disposeCompletion) {
        return;
    }

    const originalLoops = new Map<HTMLVideoElement, boolean>();
    const completed = new WeakSet<HTMLVideoElement>();
    const prepareVideo = (video: HTMLVideoElement): void => {
        if (!originalLoops.has(video)) {
            originalLoops.set(video, video.loop);
        }
        // Native looping prevents ended from firing.
        if (video.loop) video.loop = false;
    };
    const prepareNode = (node: Node): void => {
        if (node instanceof HTMLVideoElement) prepareVideo(node);
        if (node instanceof Element) node.querySelectorAll<HTMLVideoElement>('video').forEach(prepareVideo);
    };
    const observer = new MutationObserver((records) => {
        for (const [video, loop] of originalLoops) {
            if (!video.isConnected) {
                video.loop = loop;
                originalLoops.delete(video);
            }
        }
        for (const record of records) {
            if (record.type === 'attributes' && record.target instanceof HTMLVideoElement) {
                if (record.target.isConnected) prepareVideo(record.target);
            } else {
                record.addedNodes.forEach(prepareNode);
            }
        }
    });
    const onPlay = (event: Event): void => {
        if (event.target instanceof HTMLVideoElement) {
            prepareVideo(event.target);
            completed.delete(event.target);
        }
    };
    const onEnded = (event: Event): void => {
        const video = event.target;
        if (!(video instanceof HTMLVideoElement) || !video.ended || !video.isConnected) return;
        // Prevent the page's ended handlers from immediately restarting playback.
        event.stopImmediatePropagation();
        if (completed.has(video)) return;
        completed.add(video);
        if (mode === 'next' && isInViewport(video)) goToNextVideo(video);
    };

    window.addEventListener('play', onPlay, true);
    window.addEventListener('ended', onEnded, true);
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['loop'] });
    document.querySelectorAll<HTMLVideoElement>('video').forEach(prepareVideo);

    disposeCompletion = () => {
        observer.disconnect();
        window.removeEventListener('play', onPlay, true);
        window.removeEventListener('ended', onEnded, true);
        for (const [video, loop] of originalLoops) video.loop = loop;
        originalLoops.clear();
    };
}
