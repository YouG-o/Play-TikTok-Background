import { coreLog } from '../utils/logger';

// Only the React internals needed to discover TikTok's existing callbacks.
interface Fiber {
    return?: Fiber | null;
    child?: Fiber | null;
    sibling?: Fiber | null;
    stateNode?: unknown;
    memoizedProps?: {
        onNavigate?: unknown;
        itemList?: unknown;
        nextLoading?: boolean;
    };
    memoizedState?: Hook | null;
}

interface Hook {
    memoizedState?: unknown;
    next?: Hook | null;
}

interface Callback {
    invoke: (method: string) => void;
    dependency: unknown;
    source: string;
}

const NEXT_CALLBACK = /^function\(([$\w]+)\)\{return([$\w]+)\(\1,1\);?\}$/;
const PREVIOUS_CALLBACK = /^function\(([$\w]+)\)\{return([$\w]+)\(\1,-1\);?\}$/;

function getCurrentRoot(video: HTMLVideoElement): Fiber | null {
    for (let element: Element | null = video; element; element = element.parentElement) {
        const key = Object.getOwnPropertyNames(element).find((name) => name.startsWith('__reactFiber$'));
        if (!key) continue;
        let fiber = Reflect.get(element, key) as Fiber | null;
        let remaining = 500;
        while (fiber?.return && remaining-- > 0) fiber = fiber.return;
        if (!fiber || fiber.return) return null;
        return (fiber.stateNode as { current?: Fiber } | null)?.current ?? null;
    }
    return null;
}

function getNextCallback(fiber: Fiber): Callback | undefined {
    const callbacks: Callback[] = [];
    let hook = fiber.memoizedState;
    for (let index = 0; hook && index < 150; index++, hook = hook.next) {
        const state = hook.memoizedState;
        if (Array.isArray(state) && typeof state[0] === 'function') {
            callbacks.push({
                invoke: state[0],
                dependency: Array.isArray(state[1]) ? state[1][0] : undefined,
                source: Function.prototype.toString.call(state[0]).replace(/\s+/g, '')
            });
        }
    }
    // Match both directions and their shared handler, rather than a hook position
    // or a minified function name. Unknown implementations use the fallback.
    return callbacks.find((next) => NEXT_CALLBACK.test(next.source) &&
        typeof next.dependency === 'function' && callbacks.some((previous) =>
            PREVIOUS_CALLBACK.test(previous.source) && previous.dependency === next.dependency));
}

/** Return true when native navigation handled the request, including loading. */
export function tryNativeNextVideo(video: HTMLVideoElement): boolean {
    try {
        // Re-read the committed tree each time: cached callbacks retain old indexes.
        const root = getCurrentRoot(video);
        if (!root) return false;
        const stack = [root];
        let remaining = 30000;
        while (stack.length && remaining-- > 0) {
            const fiber = stack.pop()!;
            const props = fiber.memoizedProps;
            if (typeof props?.onNavigate === 'function' && Array.isArray(props.itemList)) {
                const next = getNextCallback(fiber);
                if (next) {
                    if (!props.nextLoading) next.invoke('click');
                    return true;
                }
            }
            for (let child = fiber.child; child; child = child.sibling) stack.push(child);
        }
    } catch (error) {
        coreLog('Native next-video navigation unavailable, using fallback:', error);
    }
    return false;
}
