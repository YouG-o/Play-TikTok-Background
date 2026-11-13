import { ExtensionSettings } from '../types/types';

export type PlaybackControls = Record<keyof ExtensionSettings, HTMLInputElement>;

/** Render the same accessible controls in the popup and the settings page. */
export function renderPlaybackControls(): PlaybackControls {
    const container = document.getElementById('playbackControls')!;
    container.innerHTML = `
        <section class="rounded-xl border border-blue-400/60 bg-blue-500/10 p-4" aria-labelledby="backgroundHeading">
            <h2 id="backgroundHeading" class="mb-3 text-xs font-semibold uppercase tracking-wide text-blue-300">Background playback</h2>
            <div id="backgroundControl"></div>
        </section>
        <section class="mt-4 rounded-xl border border-gray-600 p-4" aria-labelledby="completionHeading">
            <h2 id="completionHeading" class="text-sm font-semibold text-white">When a video ends</h2>
            <p class="mb-4 mt-1 text-xs leading-relaxed text-gray-400">Optional. Choose one mode, or leave both off to repeat videos as usual.</p>
            <div id="completionControls" class="space-y-4 divide-y divide-gray-600"></div>
        </section>`;

    const toggle = (parentId: string, id: string, title: string, description: string): HTMLInputElement => {
        const label = document.createElement('label');
        label.className = 'feature-row';
        label.htmlFor = id;
        const text = document.createElement('span');
        text.className = 'min-w-0';
        const heading = document.createElement('span');
        heading.className = 'block text-sm font-semibold text-white';
        heading.textContent = title;
        const help = document.createElement('span');
        help.className = 'mt-1 block text-xs leading-relaxed text-gray-300';
        help.id = `${id}Description`;
        help.textContent = description;
        text.append(heading, help);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'feature-toggle';
        input.id = id;
        input.disabled = true;
        input.setAttribute('role', 'switch');
        input.setAttribute('aria-describedby', help.id);
        label.append(text, input);
        document.getElementById(parentId)!.append(label);
        return input;
    };

    return {
        playInBackground: toggle('backgroundControl', 'playInBackgroundFeature', 'Keep videos playing',
            'Continue playing when switching tabs or minimizing the browser.'),
        preventRepeat: toggle('completionControls', 'preventRepeatFeature', 'Prevent video from repeating',
            'Stop at the end. Move to the next video yourself.'),
        autoScroll: toggle('completionControls', 'autoScrollFeature', 'Auto-scroll to next video',
            'Automatically move to the next video when playback finishes.')
    };
}
