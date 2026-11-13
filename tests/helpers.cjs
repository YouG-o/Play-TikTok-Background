const vm = require('node:vm');
const { buildSync } = require('esbuild');

const bundles = new Map();
function getBundle(entry) {
    if (!bundles.has(entry)) {
        bundles.set(entry, buildSync({
            entryPoints: [entry], bundle: true, write: false,
            platform: 'browser', format: 'cjs'
        }).outputFiles[0].text);
    }
    return bundles.get(entry);
}

function createEnvironment() {
    const listeners = new Map();
    const videos = [];
    const observers = [];
    const storageListeners = [];
    const mutations = [];
    const buttons = [];
    const cards = [];
    const window = {
        innerWidth: 1000, innerHeight: 800,
        addEventListener(type, listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
        },
        removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
        dispatchEvent(event) {
            for (const listener of listeners.get(event.type) ?? []) listener(event);
            return true;
        }
    };
    const document = { hidden: false, hasFocus: () => !document.hidden, querySelectorAll: (selector) =>
        selector === 'video' ? videos : selector.includes('arrow-right') ? buttons : cards };
    class Element {
        rect = { left: 0, right: 400, top: 0, bottom: 600, width: 400, height: 600 };
        getBoundingClientRect() { return this.rect; }
        querySelectorAll() { return []; }
        hasAttribute() { return false; }
        getAttribute() { return null; }
        closest() { return this.card ?? null; }
        contains(element) { return this === element; }
    }
    class HTMLMediaElement extends Element {
        paused = false;
        ended = false;
        isConnected = true;
        pauseCalls = 0;
        pause() { this.pauseCalls++; this.paused = true; }
    }
    class HTMLVideoElement extends HTMLMediaElement {
        loop = true;
    }
    class MutationObserver {
        constructor(callback) { this.callback = callback; mutations.push(this); }
        observe() {}
        disconnect() { this.disconnected = true; }
    }
    class IntersectionObserver {
        targets = new Set();
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(video) { this.targets.add(video); }
        unobserve(video) { this.targets.delete(video); }
        disconnect() { this.targets.clear(); }
    }
    const browser = { storage: {
        local: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener: (listener) => storageListeners.push(listener) }
    } };
    function run(entry) {
        const module = { exports: {} };
        vm.runInNewContext(getBundle(entry), {
            module, window, document, browser, Event, URLSearchParams,
            HTMLMediaElement, HTMLVideoElement, IntersectionObserver, MutationObserver, Element,
            console: { log() {}, error() {} }
        });
        return module.exports;
    }
    function video() {
        const element = new HTMLVideoElement();
        videos.push(element);
        return element;
    }
    return { window, document, browser, storageListeners, listeners, observers,
        HTMLMediaElement, Element, video, run, mutations, buttons, cards };
}


module.exports = { createEnvironment };
