import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	useThemeStore,
	applyColorMode,
	getResolvedColorMode,
} from "../src/store/themeStore";

describe("Theme Store & Dark/Light Mode", () => {
	let classListSet: Set<string>;

	beforeEach(() => {
		classListSet = new Set<string>();
		(globalThis as unknown as { document: unknown }).document = {
			documentElement: {
				classList: {
					add: (cls: string) => classListSet.add(cls),
					remove: (cls: string) => classListSet.delete(cls),
					contains: (cls: string) => classListSet.has(cls),
				},
				style: {
					setProperty: vi.fn(),
				},
			},
		};
		useThemeStore.setState({ colorMode: "system" });
	});


	it("defaults to system colorMode", () => {
		expect(useThemeStore.getState().colorMode).toBe("system");
	});

	it("resolves dark and light modes directly", () => {
		expect(getResolvedColorMode("dark")).toBe("dark");
		expect(getResolvedColorMode("light")).toBe("light");
	});

	it("applies dark class when mode is dark", () => {
		applyColorMode("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("removes dark class when mode is light", () => {
		document.documentElement.classList.add("dark");
		applyColorMode("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("updates store and applies mode on setColorMode", () => {
		const setColorMode = useThemeStore.getState().setColorMode;
		setColorMode("dark");
		expect(useThemeStore.getState().colorMode).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);

		setColorMode("light");
		expect(useThemeStore.getState().colorMode).toBe("light");
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});
});
