const assert = require('node:assert/strict');
const test = require('node:test');
const { createEnvironment } = require('./helpers.cjs');

const enginePath = 'src/content/backgroundPlayback.ts';
const pagePath = 'src/content/page.ts';
const contentPath = 'src/content/index.ts';
const enabledSettings = { playInBackground: { enabled: true } };
const disabledSettings = { playInBackground: { enabled: false } };
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('protects every playing video in the viewport, including videos added in background', () => {
    const env = createEnvironment();
    const first = env.video();
    env.run(enginePath).setupBackgroundPlayback();
    env.document.hidden = true;
    const next = env.video();
    env.window.dispatchEvent({ type: 'play', target: next });
    first.pause();
    next.pause();
    assert.equal(first.paused, false);
    assert.equal(next.paused, false);
    assert.ok(env.observers[0].targets.has(next));
});

test('allows foreground pauses even when the document has no focus', () => {
    const env = createEnvironment();
    env.document.hasFocus = () => false;
    const video = env.video();
    env.run(enginePath).setupBackgroundPlayback();
    video.pause();
    assert.equal(video.pauseCalls, 1);
});

test('allows pauses for audio, offscreen, detached, paused and ended videos', () => {
    const env = createEnvironment();
    const offscreen = env.video();
    offscreen.rect = { ...offscreen.rect, top: 900, bottom: 1500 };
    const detached = env.video();
    detached.isConnected = false;
    const paused = env.video();
    paused.paused = true;
    const ended = env.video();
    ended.ended = true;
    const audio = new env.HTMLMediaElement();
    env.run(enginePath).setupBackgroundPlayback();
    env.document.hidden = true;
    for (const media of [offscreen, detached, paused, ended, audio]) {
        media.pause();
        assert.equal(media.pauseCalls, 1);
    }
});

test('stops the previous video after scrolling and protects the next one', () => {
    const env = createEnvironment();
    const previous = env.video();
    env.run(enginePath).setupBackgroundPlayback();
    env.document.hidden = true;
    previous.pause();
    assert.equal(previous.paused, false);
    previous.rect = { ...previous.rect, top: -700, bottom: -100 };
    env.observers[0].callback([{ target: previous, isIntersecting: false }]);
    assert.equal(previous.paused, true);
    const next = env.video();
    env.window.dispatchEvent({ type: 'play', target: next });
    next.pause();
    assert.equal(next.paused, false);
});

test('does not pause a video for an outdated intersection notification', () => {
    const env = createEnvironment();
    const video = env.video();
    env.run(enginePath).setupBackgroundPlayback();
    env.document.hidden = true;
    env.observers[0].callback([{ target: video, isIntersecting: false }]);
    assert.equal(video.paused, false);
    video.isConnected = false;
    env.observers[0].callback([{ target: video, isIntersecting: false }]);
    assert.equal(env.observers[0].targets.has(video), false);
});

test('does not restart playback after a native media pause', () => {
    const env = createEnvironment();
    const video = env.video();
    const nativePause = env.HTMLMediaElement.prototype.pause;
    env.run(enginePath).setupBackgroundPlayback();
    env.document.hidden = true;
    nativePause.call(video);
    env.window.dispatchEvent({ type: 'pause', target: video });
    assert.equal(video.paused, true);
});

test('enable and cleanup are idempotent and restore native behavior', () => {
    const env = createEnvironment();
    const video = env.video();
    const nativePause = env.HTMLMediaElement.prototype.pause;
    const engine = env.run(enginePath);
    engine.setupBackgroundPlayback();
    engine.setupBackgroundPlayback();
    assert.equal(env.observers.length, 1);
    engine.cleanupBackgroundPlayback();
    engine.cleanupBackgroundPlayback();
    assert.equal(env.HTMLMediaElement.prototype.pause, nativePause);
    assert.equal(env.observers[0].targets.size, 0);
    assert.equal(env.listeners.get('play').size, 0);
    env.document.hidden = true;
    video.pause();
    assert.equal(video.paused, true);
    video.paused = false;
    engine.setupBackgroundPlayback();
    video.pause();
    assert.equal(video.paused, false);
});

test('cleanup preserves later wrappers and deactivates any retained interceptor', () => {
    const env = createEnvironment();
    const video = env.video();
    const engine = env.run(enginePath);
    engine.setupBackgroundPlayback();
    const interceptedPause = env.HTMLMediaElement.prototype.pause;
    const laterPause = function() { interceptedPause.call(this); };
    env.HTMLMediaElement.prototype.pause = laterPause;
    engine.cleanupBackgroundPlayback();
    assert.equal(env.HTMLMediaElement.prototype.pause, laterPause);
    env.document.hidden = true;
    video.pause();
    assert.equal(video.paused, true);
});

for (const pageFirst of [true, false]) {
    test(`synchronizes initial settings with page script loaded ${pageFirst ? 'first' : 'last'}`, async () => {
        const env = createEnvironment();
        const nativePause = env.HTMLMediaElement.prototype.pause;
        if (pageFirst) env.run(pagePath);
        env.run(contentPath);
        await flush();
        if (!pageFirst) env.run(pagePath);
        assert.notEqual(env.HTMLMediaElement.prototype.pause, nativePause);
        env.browser.storage.local.get = async () => ({ settings: disabledSettings });
        env.storageListeners[0]({ settings: { newValue: disabledSettings } }, 'local');
        await flush();
        assert.equal(env.HTMLMediaElement.prototype.pause, nativePause);
        env.browser.storage.local.get = async () => ({ settings: enabledSettings });
        env.storageListeners[0]({ settings: { newValue: enabledSettings } }, 'local');
        await flush();
        assert.notEqual(env.HTMLMediaElement.prototype.pause, nativePause);
    });
}

test('a stale initial storage read cannot overwrite a newer settings update', async () => {
    const env = createEnvironment();
    const nativePause = env.HTMLMediaElement.prototype.pause;
    let resolveInitialRead;
    env.browser.storage.local.get = () => new Promise((resolve) => { resolveInitialRead = resolve; });
    env.run(pagePath);
    env.run(contentPath);
    env.browser.storage.local.get = async () => ({ settings: disabledSettings });
    env.storageListeners[0]({ settings: { newValue: disabledSettings } }, 'local');
    await flush();
    resolveInitialRead({ settings: enabledSettings });
    await flush();
    assert.equal(env.HTMLMediaElement.prototype.pause, nativePause);
});
