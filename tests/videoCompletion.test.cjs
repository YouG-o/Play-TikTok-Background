const assert = require('node:assert/strict');
const test = require('node:test');
const { createEnvironment } = require('./helpers.cjs');

const completionPath = 'src/content/videoCompletion.ts';
function finish(env, video) {
    video.ended = true;
    let intercepted = false;
    env.window.dispatchEvent({ type: 'ended', target: video,
        stopImmediatePropagation() { intercepted = true; } });
    return intercepted;
}

test('optional completion modes leave native looping unchanged by default', () => {
    const env = createEnvironment();
    const video = env.video();
    env.run(completionPath).setVideoCompletionMode('repeat');
    assert.equal(video.loop, true);
    assert.equal(env.mutations.length, 0);
});

test('stop mode disables native looping and prevents page ended handlers from replaying', () => {
    const env = createEnvironment();
    const video = env.video();
    let clicks = 0;
    env.buttons.push(Object.assign(new env.Element(), { click() { clicks++; } }));
    env.run(completionPath).setVideoCompletionMode('stop');
    assert.equal(video.loop, false);
    assert.equal(finish(env, video), true);
    assert.equal(clicks, 0);
});

test('auto-scroll navigates once per completion', () => {
    const env = createEnvironment();
    const video = env.video();
    let clicks = 0;
    env.buttons.push(Object.assign(new env.Element(), { click() { clicks++; } }));
    env.run(completionPath).setVideoCompletionMode('next');
    finish(env, video);
    finish(env, video);
    assert.equal(clicks, 1);
    video.ended = false;
    env.window.dispatchEvent({ type: 'play', target: video });
    finish(env, video);
    assert.equal(clicks, 2);
});

test('auto-scroll falls back to the next feed card when navigation is unavailable', () => {
    const env = createEnvironment();
    const video = env.video();
    const current = new env.Element();
    const next = new env.Element();
    let scrolls = 0;
    next.scrollIntoView = () => { scrolls++; };
    video.card = current;
    env.cards.push(current, next);
    env.run(completionPath).setVideoCompletionMode('next');
    finish(env, video);
    assert.equal(scrolls, 1);
});

test('offscreen videos and ordinary pause events do not navigate', () => {
    const env = createEnvironment();
    const video = env.video();
    let clicks = 0;
    env.buttons.push(Object.assign(new env.Element(), { click() { clicks++; } }));
    env.run(completionPath).setVideoCompletionMode('next');
    env.window.dispatchEvent({ type: 'pause', target: video });
    video.rect = { ...video.rect, top: 900, bottom: 1500 };
    finish(env, video);
    assert.equal(clicks, 0);
});

test('new videos and page loop changes are handled without polling', () => {
    const env = createEnvironment();
    env.run(completionPath).setVideoCompletionMode('stop');
    const video = env.video();
    env.mutations[0].callback([{ type: 'childList', addedNodes: [video] }]);
    assert.equal(video.loop, false);
    video.loop = true;
    env.mutations[0].callback([{ type: 'attributes', target: video }]);
    assert.equal(video.loop, false);
});

test('mode changes reuse listeners, and disabling restores original loop settings', () => {
    const env = createEnvironment();
    const looping = env.video();
    const nonLooping = env.video();
    nonLooping.loop = false;
    const { setVideoCompletionMode } = env.run(completionPath);
    setVideoCompletionMode('next');
    setVideoCompletionMode('stop');
    assert.equal(env.mutations.length, 1);
    setVideoCompletionMode('repeat');
    assert.equal(looping.loop, true);
    assert.equal(nonLooping.loop, false);
    assert.equal(env.listeners.get('ended').size, 0);
    assert.equal(env.mutations[0].disconnected, true);
});

test('old settings receive disabled optional features without changing background preference', async () => {
    const env = createEnvironment();
    env.browser.storage.local.get = async () => ({ settings: { playInBackground: { enabled: false } } });
    const settings = await env.run('src/utils/settings.ts').loadExtensionSettings();
    assert.equal(settings.playInBackground.enabled, false);
    assert.equal(settings.preventRepeat.enabled, false);
    assert.equal(settings.autoScroll.enabled, false);
});

test('conflicting stored completion modes are normalized and persisted', async () => {
    const env = createEnvironment();
    env.browser.storage.local.get = async () => ({ settings: {
        playInBackground: { enabled: true }, preventRepeat: { enabled: true }, autoScroll: { enabled: true }
    } });
    let saved;
    env.browser.storage.local.set = async (data) => { saved = data.settings; };
    const settings = await env.run('src/utils/settings.ts').loadExtensionSettings();
    assert.equal(settings.autoScroll.enabled, true);
    assert.equal(settings.preventRepeat.enabled, false);
    assert.equal(saved.preventRepeat.enabled, false);
});

test('completion settings work independently of background playback and update without reload', async () => {
    const env = createEnvironment();
    const video = env.video();
    const nativePause = env.HTMLMediaElement.prototype.pause;
    let settings = {
        playInBackground: { enabled: false }, preventRepeat: { enabled: false }, autoScroll: { enabled: true }
    };
    env.browser.storage.local.get = async () => ({ settings });
    env.run('src/content/page.ts');
    env.run('src/content/index.ts');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(video.loop, false);
    assert.equal(env.HTMLMediaElement.prototype.pause, nativePause);
    settings = { ...settings, autoScroll: { enabled: false } };
    env.storageListeners[0]({ settings: { newValue: settings } }, 'local');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(video.loop, true);
});
