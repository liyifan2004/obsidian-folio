import { describe, expect, it } from "vitest";
import {
	DEFAULT_SETTINGS,
	getAvailableLanguages,
	getLanguageName,
	getTranslationKeys,
	resolveLanguage,
	setLanguage,
	t
} from "../src/types";
import { __setLanguage } from "./mocks/obsidian";

/**
 * i18n 一致性测试。
 *
 * 9 种语言的翻译表必须与英文基线键集完全一致，否则缺失的键会静默
 * 回退到英文（用户看到中英混排却没有任何报错）。
 */

const LANGUAGES = ["en", "zh", "zh-TW", "ja", "ko", "fr", "de", "es", "ar"] as const;

describe("翻译表键集一致", () => {
	it("9 种语言全部存在", () => {
		expect(getAvailableLanguages().sort()).toEqual([...LANGUAGES].sort());
	});

	it("每种语言的键集与英文基线完全一致（无缺失、无多余）", () => {
		const englishKeys = getTranslationKeys("en");
		expect(englishKeys.length).toBeGreaterThan(0);

		for (const lang of LANGUAGES) {
			const keys = getTranslationKeys(lang);
			const set = new Set(keys);

			// 无重复
			expect(keys.length, `${lang} 存在重复键`).toBe(set.size);

			// 无缺失
			const missing = englishKeys.filter((k) => !set.has(k));
			expect(missing, `${lang} 缺少键`).toEqual([]);

			// 无多余
			const extra = keys.filter((k) => !englishKeys.includes(k));
			expect(extra, `${lang} 多出键`).toEqual([]);
		}
	});

	it("所有语言的文案均非空", () => {
		for (const lang of LANGUAGES) {
			setLanguage(lang);
			for (const key of getTranslationKeys("en")) {
				const value = t(key);
				expect(value.trim().length, `${lang}/${key} 文案为空`).toBeGreaterThan(0);
				expect(value, `${lang}/${key} 未翻译`).not.toBe(key);
			}
		}
	});
});

describe("语言解析", () => {
	it("'auto' 跟随 Obsidian 界面语言", () => {
		__setLanguage("zh-tw");
		expect(resolveLanguage("auto")).toBe("zh-TW");
	});

	it("完整语言码优先于基础语言码（zh-TW > zh）", () => {
		__setLanguage("zh-TW");
		expect(resolveLanguage("auto")).toBe("zh-TW");
		__setLanguage("zh-CN");
		expect(resolveLanguage("auto")).toBe("zh");
	});

	it("未知语言回退英文", () => {
		__setLanguage("xx-YY");
		expect(resolveLanguage("auto")).toBe("en");
	});

	it("手动指定语言时忽略 Obsidian 界面语言", () => {
		__setLanguage("zh-CN");
		expect(resolveLanguage("ja")).toBe("ja");
	});

	it("非法持久化值回退自动检测", () => {
		__setLanguage("fr");
		expect(resolveLanguage("klingon" as never)).toBe("fr");
	});

	it("getLanguageName 对全部语言返回非空名称", () => {
		for (const lang of getAvailableLanguages()) {
			expect(getLanguageName(lang).length).toBeGreaterThan(0);
		}
	});
});

describe("缺失键回退英文", () => {
	it("未知键返回键名本身而非空串", () => {
		setLanguage("en");
		expect(t("thisKeyDoesNotExist")).toBe("thisKeyDoesNotExist");
	});
});

describe("默认设置", () => {
	it("默认重叠 2 行、语言自动", () => {
		expect(DEFAULT_SETTINGS.overlapLines).toBe(2);
		expect(DEFAULT_SETTINGS.language).toBe("auto");
	});
});
