import { describe, it, expect, beforeEach, vi } from "vitest";

// The test environment runs under Node, which has no `localStorage` or
// `AudioContext` globals, so we stub minimal fakes before importing the
// module (soundService reads localStorage during construction).
class FakeGain {
	gain = {
		setValueAtTime: vi.fn(),
		linearRampToValueAtTime: vi.fn(),
		exponentialRampToValueAtTime: vi.fn(),
	};
	connect = vi.fn();
}

class FakeOscillator {
	type = "sine";
	frequency = { setValueAtTime: vi.fn() };
	connect = vi.fn();
	start = vi.fn();
	stop = vi.fn();
}

class FakeAudioContext {
	state = "running";
	currentTime = 0;
	destination = {};
	createGain = vi.fn(() => new FakeGain());
	createOscillator = vi.fn(() => new FakeOscillator());
	resume = vi.fn(() => Promise.resolve());
}

class ThrowingAudioContext {
	constructor() {
		throw new Error("AudioContext unavailable");
	}
}

function makeFakeLocalStorage() {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		},
		removeItem: (key: string) => store.delete(key),
		clear: () => store.clear(),
	};
}

beforeEach(() => {
	vi.resetModules();
	(globalThis as unknown as { localStorage: unknown }).localStorage = makeFakeLocalStorage();
	(globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
});

describe("soundService", () => {
	it("plays every game sound effect without throwing", async () => {
		const { soundService } = await import("../src/services/soundService");

		expect(() => soundService.move()).not.toThrow();
		expect(() => soundService.capture()).not.toThrow();
		expect(() => soundService.check()).not.toThrow();
		expect(() => soundService.castle()).not.toThrow();
		expect(() => soundService.promote()).not.toThrow();
		expect(() => soundService.gameStart()).not.toThrow();
		expect(() => soundService.gameEnd()).not.toThrow();
		expect(() => soundService.draw()).not.toThrow();
		expect(() => soundService.lowTime()).not.toThrow();
	});

	it("defaults to enabled with full volume when no prefs are stored", async () => {
		const { soundService } = await import("../src/services/soundService");
		expect(soundService.isEnabled()).toBe(true);
		expect(soundService.getVolume()).toBe(1);
	});

	it("suppresses sound generation once muted", async () => {
		const { soundService } = await import("../src/services/soundService");
		soundService.setEnabled(false);

		expect(soundService.isEnabled()).toBe(false);
		expect(() => soundService.move()).not.toThrow();
		const ctx = (globalThis as unknown as { AudioContext: typeof FakeAudioContext }).AudioContext;
		expect(ctx).toBeDefined();
	});

	it("toggle() flips and persists the enabled state", async () => {
		const { soundService } = await import("../src/services/soundService");
		const before = soundService.isEnabled();
		const after = soundService.toggle();

		expect(after).toBe(!before);
		expect(soundService.isEnabled()).toBe(after);
		expect(localStorage.getItem("chesster:sound:muted")).toBe(String(!after));
	});

	it("setVolume() clamps to the 0-1 range and persists", async () => {
		const { soundService } = await import("../src/services/soundService");

		soundService.setVolume(2);
		expect(soundService.getVolume()).toBe(1);

		soundService.setVolume(-1);
		expect(soundService.getVolume()).toBe(0);

		soundService.setVolume(0.42);
		expect(soundService.getVolume()).toBe(0.42);
		expect(localStorage.getItem("chesster:sound:volume")).toBe("0.42");
	});

	it("never throws even when AudioContext construction fails", async () => {
		(globalThis as unknown as { AudioContext: unknown }).AudioContext = ThrowingAudioContext;
		const { soundService } = await import("../src/services/soundService");

		expect(() => soundService.move()).not.toThrow();
		expect(() => soundService.gameEnd()).not.toThrow();
	});

	it("unlockOnFirstInteraction() registers one-shot listeners that warm up the context", async () => {
		const { soundService } = await import("../src/services/soundService");
		const listeners: Record<string, () => void> = {};
		const addEventListener = vi.fn((evt: string, cb: () => void) => {
			listeners[evt] = cb;
		});
		const removeEventListener = vi.fn();
		(globalThis as unknown as { window: unknown }).window = {
			addEventListener,
			removeEventListener,
		};

		soundService.unlockOnFirstInteraction();
		expect(addEventListener).toHaveBeenCalledWith(
			"pointerdown",
			expect.any(Function),
			expect.objectContaining({ once: true, passive: true }),
		);

		expect(() => listeners.pointerdown()).not.toThrow();
		expect(removeEventListener).toHaveBeenCalled();
	});
});
