/**
 * audio.ts
 * Optional lo-fi background audio for the office.
 *
 * MUTED BY DEFAULT — user must opt in via localStorage flag `office_audio_enabled`.
 * Source: /public/office/audio/lofi-loop.mp3
 *
 * If the audio file doesn't exist, a console warning is logged and play() is a no-op.
 *
 * IMPORTANT: No audio plays on page load. This is always off unless the user
 * explicitly enables it via a UI toggle (future scope) or direct localStorage set.
 */

const AUDIO_SRC = "/office/audio/lofi-loop.mp3";
const LS_KEY = "office_audio_enabled";

export interface AudioController {
	play: () => Promise<void>;
	pause: () => void;
	setVolume: (v: number) => void;
}

let _audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
	if (!_audio) {
		_audio = new Audio(AUDIO_SRC);
		_audio.loop = true;
		_audio.volume = 0.25; // default low volume
		_audio.preload = "none"; // don't auto-load until requested
		_audio.addEventListener("error", () => {
			console.warn(
				"[office/ambient] lo-fi audio file not found at",
				AUDIO_SRC,
				"— drop a royalty-free lofi-loop.mp3 into public/office/audio/ to enable music.",
			);
		});
	}
	return _audio;
}

/**
 * Initialise the ambient audio controller.
 * Audio is ALWAYS muted by default — call play() only after explicit user opt-in.
 */
export function initAudio(): AudioController {
	return {
		async play(): Promise<void> {
			const enabled = localStorage.getItem(LS_KEY) === "true";
			if (!enabled) {
				console.info(
					'[office/ambient] audio disabled — set localStorage.office_audio_enabled="true" to opt in.',
				);
				return;
			}
			try {
				await getAudio().play();
			} catch (err) {
				console.warn("[office/ambient] audio play failed:", err);
			}
		},

		pause(): void {
			if (_audio && !_audio.paused) {
				_audio.pause();
			}
		},

		setVolume(v: number): void {
			const clamped = Math.max(0, Math.min(1, v));
			getAudio().volume = clamped;
		},
	};
}
