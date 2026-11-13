const assert = require('node:assert/strict');
const test = require('node:test');
const { createEnvironment } = require('./helpers.cjs');

const flush = () => new Promise((resolve) => setImmediate(resolve));
async function openPopup() {
    const env = createEnvironment();
    const elements = new Map();
    const createElement = () => ({ checked: false, disabled: true, listeners: {}, children: [],
        set id(value) { this.elementId = value; elements.set(value, this); },
        get id() { return this.elementId; },
        setAttribute() {},
        append(...children) { this.children.push(...children); },
        addEventListener(type, listener) { this.listeners[type] = listener; } });
    for (const id of ['playbackControls', 'extensionVersion', 'backgroundControl', 'completionControls']) {
        const element = createElement();
        element.id = id;
    }
    let onReady;
    env.document.getElementById = (id) => elements.get(id);
    env.document.createElement = createElement;
    env.document.addEventListener = (type, listener) => { if (type === 'DOMContentLoaded') onReady = listener; };
    env.window.location = { search: '' };
    env.browser.runtime = { getManifest: () => ({ version: '1.0.1' }) };
    let stored;
    env.browser.storage.local.get = async () => stored ? { settings: stored } : {};
    const writes = [];
    env.browser.storage.local.set = async ({ settings }) => {
        stored = settings;
        writes.push(settings);
        for (const listener of env.storageListeners) listener({ settings: { newValue: settings } }, 'local');
    };
    env.run('src/popup/popup.ts');
    onReady();
    await flush();
    return { elements, writes, change(id, checked) {
        const input = elements.get(id);
        input.checked = checked;
        input.listeners.change();
    } };
}

test('popup keeps background playback enabled and both completion modes disabled by default', async () => {
    const { elements } = await openPopup();
    assert.equal(elements.get('playInBackgroundFeature').checked, true);
    assert.equal(elements.get('preventRepeatFeature').checked, false);
    assert.equal(elements.get('autoScrollFeature').checked, false);
    assert.equal(elements.get('autoScrollFeature').disabled, false);
    assert.match(elements.get('playbackControls').innerHTML, /When a video ends/);
});

test('selecting either completion mode turns the other off and persists both switches', async () => {
    const { elements, writes, change } = await openPopup();
    change('preventRepeatFeature', true);
    await flush();
    change('autoScrollFeature', true);
    await flush();
    assert.equal(elements.get('preventRepeatFeature').checked, false);
    assert.equal(writes.at(-1).autoScroll.enabled, true);
    assert.equal(writes.at(-1).preventRepeat.enabled, false);
    change('preventRepeatFeature', true);
    await flush();
    assert.equal(elements.get('autoScrollFeature').checked, false);
    assert.equal(writes.at(-1).preventRepeat.enabled, true);
    assert.equal(writes.at(-1).autoScroll.enabled, false);
    change('preventRepeatFeature', false);
    await flush();
    assert.equal(writes.at(-1).preventRepeat.enabled, false);
    assert.equal(writes.at(-1).autoScroll.enabled, false);
    assert.equal(writes.at(-1).playInBackground.enabled, true);
});

test('rapid switches are saved in order without enabling both completion modes', async () => {
    const { writes, change } = await openPopup();
    change('autoScrollFeature', true);
    change('preventRepeatFeature', true);
    change('playInBackgroundFeature', false);
    await flush();
    assert.equal(writes.length, 3);
    assert.equal(writes[0].autoScroll.enabled, true);
    assert.equal(writes.at(-1).preventRepeat.enabled, true);
    assert.equal(writes.at(-1).autoScroll.enabled, false);
    assert.equal(writes.at(-1).playInBackground.enabled, false);
});
