const assert = require('node:assert/strict');
const test = require('node:test');
const { createEnvironment } = require('./helpers.cjs');

const nativePath = 'src/content/nativeNavigation.ts';

function createRoot(handler, options = {}) {
    // Match the native callback shapes observed in TikTok, with shared dependencies.
    const next = function(event) { return handler(event, 1); };
    const previous = function(event) { return handler(event, -1); };
    const navigation = {
        memoizedProps: { onNavigate() {}, itemList: ['first', 'second'], ...options },
        memoizedState: {
            memoizedState: false,
            next: { memoizedState: [next, [handler]],
                next: { memoizedState: [previous, [handler]] } }
        }
    };
    const root = { child: navigation };
    root.stateNode = { current: root };
    return { root, navigation };
}

test('invokes the native next callback with the click method', () => {
    const env = createEnvironment();
    const video = env.video();
    const calls = [];
    const { root } = createRoot((...args) => calls.push(args));
    video.__reactFiber$test = { return: root };
    assert.equal(env.run(nativePath).tryNativeNextVideo(video), true);
    assert.deepEqual(calls, [['click', 1]]);
});

test('re-reads the committed tree after React replaces callbacks', () => {
    const env = createEnvironment();
    const video = env.video();
    const calls = [];
    const first = createRoot(() => calls.push('first'));
    const second = createRoot(() => calls.push('second'));
    video.__reactFiber$test = { return: first.root };
    const { tryNativeNextVideo } = env.run(nativePath);
    tryNativeNextVideo(video);
    first.root.stateNode.current = second.root;
    tryNativeNextVideo(video);
    assert.deepEqual(calls, ['first', 'second']);
});

test('rejects callbacks that do not share the same navigation handler', () => {
    const env = createEnvironment();
    const video = env.video();
    const { root, navigation } = createRoot(() => assert.fail('Unexpected navigation'));
    navigation.memoizedState.next.next.memoizedState[1] = [() => {}];
    video.__reactFiber$test = { return: root };
    assert.equal(env.run(nativePath).tryNativeNextVideo(video), false);
});

test('loading native navigation does not trigger a competing fallback', () => {
    const env = createEnvironment();
    const video = env.video();
    const { root } = createRoot(() => assert.fail('Navigation is loading'), { nextLoading: true });
    video.__reactFiber$test = { return: root };
    assert.equal(env.run(nativePath).tryNativeNextVideo(video), true);
});

test('auto-scroll prefers native navigation over DOM navigation', () => {
    const env = createEnvironment();
    const video = env.video();
    let calls = 0;
    const { root } = createRoot(() => calls++);
    video.__reactFiber$test = { return: root };
    env.buttons.push(Object.assign(new env.Element(), { click() { assert.fail('DOM fallback used'); } }));
    env.run('src/content/videoCompletion.ts').setVideoCompletionMode('next');
    video.ended = true;
    env.window.dispatchEvent({ type: 'ended', target: video, stopImmediatePropagation() {} });
    assert.equal(calls, 1);
});

for (const hidden of [true, false]) {
    test(`auto-scroll uses immediate scrolling when ${hidden ? 'hidden' : 'visible but unfocused'}`, () => {
        const env = createEnvironment();
        const video = env.video();
        let nativeCalls = 0;
        const { root } = createRoot(() => nativeCalls++);
        video.__reactFiber$test = { return: root };
        env.document.hidden = hidden;
        env.document.hasFocus = () => false;
        env.buttons.push(Object.assign(new env.Element(), {
            click() { assert.fail('Button would restart the suspended native animation'); }
        }));
        const current = new env.Element();
        const next = new env.Element();
        let scrolls = 0;
        next.scrollIntoView = (options) => {
            assert.equal(options.behavior, 'instant');
            scrolls++;
        };
        video.card = current;
        env.cards.push(current, next);
        env.run('src/content/videoCompletion.ts').setVideoCompletionMode('next');
        video.ended = true;
        const finish = () => env.window.dispatchEvent({
            type: 'ended', target: video, stopImmediatePropagation() {}
        });
        finish();
        finish();
        assert.equal(nativeCalls, 0);
        assert.equal(scrolls, 1);

        // A subsequent completion after returning to TikTok uses animation again.
        env.document.hidden = false;
        env.document.hasFocus = () => true;
        video.ended = false;
        env.window.dispatchEvent({ type: 'play', target: video });
        video.ended = true;
        finish();
        assert.equal(nativeCalls, 1);
        assert.equal(scrolls, 1);
    });
}

test('native errors leave fallback navigation available', () => {
    const env = createEnvironment();
    const video = env.video();
    const { root } = createRoot(() => { throw new Error('Native navigation unavailable'); });
    video.__reactFiber$test = { return: root };
    let clicks = 0;
    env.buttons.push(Object.assign(new env.Element(), { click() { clicks++; } }));
    env.run('src/content/videoCompletion.ts').setVideoCompletionMode('next');
    video.ended = true;
    env.window.dispatchEvent({ type: 'ended', target: video, stopImmediatePropagation() {} });
    assert.equal(clicks, 1);
});

test('missing React internals return control to fallback navigation', () => {
    const env = createEnvironment();
    assert.equal(env.run(nativePath).tryNativeNextVideo(env.video()), false);
});
