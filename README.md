# Hover Translate

[![Zotero](https://img.shields.io/badge/Zotero-10.x-CC2936?style=flat-square&logo=zotero&logoColor=white)](https://www.zotero.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

English | [日本語](README.ja.md)

A Zotero plugin that translates a sentence in a PDF as soon as you rest the cursor on it.
There is no need to select text. The whole source sentence is highlighted while its translation is shown.

It is a heavily reworked version of [Nova-Meteor/zotero-sentence-hover](https://github.com/Nova-Meteor/zotero-sentence-hover) (for Chinese, v1.1.2).
The original MIT license and copyright notice are kept in [LICENSE](LICENSE).

## Features

- **Hover translation**: finds the sentence under the cursor, translates it, and shows the result in a popup (after 500 ms by default).
- **Whole-sentence highlight**: highlights the sentence being translated, line by line, on the page. It is a temporary display, not a PDF annotation.
- **Full-text translation in advance**: translates the whole PDF at once, so later hovers show the result from the cache immediately.
- **Controls in the reader**: “Translation settings” on the PDF toolbar turns translation on and off and switches the service, model, and source and target languages.
- **Translation services**: Google Translate (no API key), DeepL, Claude (Anthropic API), Gemini (Google AI API), or an LLM API you register. The LLM API accepts any service that takes the OpenAI-compatible Chat Completions format, including local LLMs such as LM Studio and Ollama.
- **Languages**: translates between English, Japanese, Chinese (Simplified), Korean, German, French and Spanish. The source language can also be detected automatically.
- **English and Japanese interface**: the plugin follows Zotero’s language. It is shown in Japanese when Zotero is in Japanese and in English otherwise. Zotero follows the system language by default; to change it, see Zotero’s settings (Advanced).

## Changes from the original

- The plugin was rebuilt for Japanese users and now also has an English interface.
- On first use, the target language is Zotero’s language when the plugin offers it (Chinese, Korean, German, French or Spanish), and Japanese otherwise. You can change it at any time.
- Google Translate, DeepL, Claude and Gemini were added.
- So that small models work, only the translation of the whole sentence is requested by default. Word-level highlighting in the translation can be turned on in the settings, but its quality depends on the model.
- The source is highlighted by whole sentence rather than by word.
- The add-on ID (`hover-translate@local`), settings and cache names differ from the original, so both can be installed at the same time.
- The update URL points to a non-existent address (`.invalid`) so that the original’s updates do not replace this plugin. Install new versions manually.

## Installation

Zotero **10.x** is required.

1. Download `hover-translate-<version>.xpi` from [Releases](https://github.com/zerollpaper/zotero-hover-translate/releases/latest) (or build it yourself into `outputs/` as described under “Development”).
2. In Zotero, open **Tools → Plugins**.
3. From the gear menu at the top right, choose **Install Plugin From File…** and select the xpi.
4. Reopen your PDFs. If the settings pane does not appear, restart Zotero.

Installing over an earlier version replaces it. Settings and caches are kept.

## Settings

Open **Zotero → Settings → Hover Translate**.

### Translation service

| Setting | Description |
| --- | --- |
| Translation service | Google Translate, DeepL, LLM API (OpenAI-compatible, local LLMs supported), Claude (Anthropic API) or Gemini (Google AI API) |
| Translate from / Translate to | “Detect language” is also available for the source |
| Service | For LLM API. Choosing OpenAI, xAI (Grok), DeepSeek, Mistral AI, Groq, OpenRouter, LM Studio or Ollama fills in the API URL. For other services, choose “Other” |
| API URL | For LLM API. With “Other”, the OpenAI-compatible URL of the service (usually ending in `…/v1`; including `/chat/completions` is fine) |
| Model name | For LLM API. The model ID defined by the service. “Load model list” lets you choose from “Available models”. For LM Studio and Ollama the list is loaded automatically (and with a single model, its name is filled in) |
| API key (optional) | For LLM API. Leave it empty for a local server that needs no authentication. Changing the service clears it together with the model name |
| Claude model name | For Claude. The default is `claude-haiku-5-5` (fast, inexpensive and good for translation) |
| Claude API key | For Claude. An API key created in the [Claude Console](https://platform.claude.com/) |
| Gemini model name | For Gemini. The default is `gemini-3.5-flash-lite` (the least expensive Gemini 3 model) |
| Gemini API key | For Gemini. An API key created in [Google AI Studio](https://aistudio.google.com/) |
| DeepL API key | For DeepL. An API key created in your DeepL account. Both Free (ending in `:fx`) and Pro keys work; the endpoint is chosen automatically |
| Highlight matching words in the translation (heavy) | Highlights, in the popup, the translation of the source word under the cursor. Available for LLM API, Claude and Gemini when translating from English. Accuracy depends on the model |

For LLM API, Claude and Gemini, **Load model list** shows the service’s models under “Available models”; choosing one fills in the model name (enter the API key first for Claude and Gemini).

**Save and test connection** saves the settings and translates one sample sentence in the source language.

### While reading

| Setting | Description |
| --- | --- |
| Enable hover translation | Same as “Translation: On/Off” in the reader |
| Highlight the whole source sentence | Highlights the sentence being translated on the page |
| Hover delay | Time between the cursor stopping and translation starting (500 ms by default) |
| Parallel requests for full-text translation | 1 to 6 (3 by default) |

### Popup appearance

| Setting | Range | Default |
| --- | --- | --- |
| Translation font size | 12–32 px | 17 px |
| Maximum width | 240–1200 px | 640 px |
| Background transparency | 0–80% | 0% (opaque) |

“Preview” shows how the popup looks with the current target language and word-highlighting settings.

## Usage

| To | Do this |
| --- | --- |
| Translate a sentence | Rest the cursor on the sentence |
| Translate the same sentence again | ↻ in the popup, or **Ctrl+Alt+R** (**⌘+Option+R** on macOS) |
| Close the popup | ×, **Esc**, or scroll the page |
| Copy the translation | Move the cursor into the popup, then select and copy |
| Switch translation on or off, or change languages or the model | “Translation settings” on the PDF toolbar |
| Translate the whole PDF in advance | “Translate all” in “Translation settings”. Click again to cancel |

## Data and caveats

- **What is sent**: the sentence you hover over is sent to the selected translation service. Google Translate and Gemini send it to Google, DeepL to DeepL, and Claude to Anthropic. To keep everything on your computer, use a local LLM.
- **Google Translate**: it uses Google’s keyless web endpoint, so usage limits or changes on Google’s side may stop it from working. Word highlighting is not supported.
- **API keys**: stored in Zotero’s preferences. Do not share your preferences file. Each service’s key is stored separately and sent only to that service.
- **Cache**: translations are saved as JSON in the folder of each PDF and are reused after restarting. Each combination of service, model, source and target language and word highlighting has its own cache. Full-text translations are stored in a separate file and are not subject to the 1,000-sentence limit of the normal cache.
- **What is not changed**: the PDF itself and Zotero items, tags, annotations and citation keys are never modified.
- **Known weaknesses**: inline formulas, image-only PDFs (no OCR), complex layouts, tables without rules, and figure labels as large as body text may be split into sentences incorrectly.
- **LLM API compatibility**: any provider works if it supports the OpenAI-compatible Chat Completions format (POST to `/chat/completions` with the API key sent as `Authorization: Bearer`). Services with their own formats or that need query parameters in the URL are not supported.
- **Claude**: uses Anthropic’s Messages API directly with low effort (`effort: low`) and a JSON schema that guarantees the reply’s shape. Usage is charged to your Claude Console credits.
- **Gemini**: uses Google’s generateContent API directly with a JSON schema. Thinking is kept to the minimum each generation allows (`low` for Gemini 3 and 4, off for 2.5 Flash; Flash-Lite and 2.5 Pro use the model default).
- **DeepL**: translations into English use American English, and Chinese uses Simplified characters. You are told when the monthly character limit is reached.
- **Translation-only local model (PLaMo 3 Translate)**: when the model name contains `plamo` and `translate`, the plugin switches to that model’s format (a `[plamo-translate]` settings message and the source text, with only the translation returned). With Ollama, install it with `ollama pull hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M`, then choose “Ollama” and the model name `hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M`. Word highlighting is not supported. PLaMo is under the PLaMo Community License, free for personal and non-commercial use.
- **LLM API URL**: HTTPS is required. HTTP is allowed only for servers on your own computer (`localhost`, `127.0.0.1`).
- **LLM API replies**: the model must answer in JSON as `{"translation":"…"}`. For services chosen from the list, the JSON output option each service documents (`response_format`) is added (a full schema for OpenAI, xAI, LM Studio and Ollama; JSON only for DeepSeek, Mistral and Groq; none for OpenRouter, which varies by model). OpenAI reasoning models (GPT-5 and the o series) are also asked for low reasoning effort. With word highlighting, the original plugin’s segments format is requested.
- Enabling the original plugin or another hover-translation plugin at the same time may produce overlapping popups.

## Development

Node.js 24 or later and Python 3 are required.

```bash
npm ci --ignore-scripts
npm test
python3 scripts/build.py
```

The xpi and its SHA-256 checksum are written to `outputs/`. Test and development dependencies are not included in the xpi.

| File | Role |
| --- | --- |
| `addon.js` | Reader controls, translation requests and the popup |
| `core.js` | Sentence splitting, word positions, validation, and the interface text in English and Japanese |
| `cache.js` | Cache |
| `fulltext.js` | Full-text translation and its progress |
| `prefs.xhtml` / `prefs.js` / `prefs.css` | Settings pane (`prefs.js` holds the English text for the pane) |
| `tests/` | Automated tests (cache, translation, simulated reader, and so on) |

Changes in each version are listed in [CHANGELOG.md](CHANGELOG.md) (in Japanese).

## License

MIT License ([LICENSE](LICENSE)). Copyright of the original program belongs to Sentence Hover contributors.
