# Hover Translate

[![Zotero](https://img.shields.io/badge/Zotero-10.x-CC2936?style=flat-square&logo=zotero&logoColor=white)](https://www.zotero.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[English](README.md) | 日本語

Zotero で英語の論文 PDF を読むとき、文にカーソルを合わせるだけで日本語訳を表示するプラグインです（他の言語の組み合わせにも使えます）。
文を選択する必要はありません。訳した文は原文側でも文全体がハイライトされます。

[Nova-Meteor/zotero-sentence-hover](https://github.com/Nova-Meteor/zotero-sentence-hover)（中国語向け、v1.1.2）を元に、
日本語で使えるように大きく作り直したものです。元の MIT ライセンスと著作権表示は [LICENSE](LICENSE) にそのまま残しています。

## できること

- **ホバー翻訳**：カーソルのある英文を自動で見つけて翻訳し、ポップアップで表示します（既定は 500 ミリ秒待ってから）。
- **文全体のハイライト**：翻訳している文を原文の上で行ごとにハイライトします。PDF の注釈としては保存しない一時的な表示です。
- **全文の事前翻訳**：PDF 全体をまとめて翻訳しておき、あとはキャッシュから即座に表示します。
- **閲覧画面での切り替え**：PDF 上部のツールバーの「翻訳設定」から、翻訳のオン・オフ、翻訳サービスとモデル、翻訳元・翻訳先を変えられます。
- **表示の言語**：Zotero の表示言語に合わせて、日本語なら日本語、それ以外なら英語で表示します。Zotero の表示言語は、標準ではシステムの言語に従い、Zotero の設定（詳細）で変えられます。
- **翻訳サービス**：Google 翻訳（API キー不要）、DeepL、Claude（Anthropic の API）、Gemini（Google の AI API）、自分で登録する LLM API から選べます。LLM API は、OpenAI 互換の Chat Completions 形式で受け付けるサービスなら OpenAI 以外でも使え、LM Studio や Ollama などのローカル LLM も使えます。

## 本家との違い

- 翻訳先の既定を日本語にしました（Zotero の表示言語が中国語・韓国語・ドイツ語・フランス語・スペイン語なら、最初はその言語）。簡体字中国語・英語・韓国語・ドイツ語・フランス語・スペイン語も選べます。
- 設定画面、ポップアップ、エラー表示を日本語と英語で表示します（Zotero の表示言語に合わせます）。
- Google 翻訳を選べるようにしました。
- 軽い（小さい）モデルでも使えるよう、既定では「文全体の訳だけ」を求めます。訳文の単語連動ハイライトは設定で有効にできますが、モデルの出力品質に左右されます。
- 原文は単語ではなく文全体をハイライトします。
- 本家と同時に入れても衝突しないよう、アドオン ID（`hover-translate@local`）、設定の保存先、キャッシュ名を分けています。
- 本家の更新で上書きされないよう、自動更新の確認先は存在しないアドレス（`.invalid`）にしています。新しい版は手動で入れ直してください。

## インストール

Zotero **10.x** が必要です。

1. [Releases](https://github.com/zerollpaper/zotero-hover-translate/releases/latest) から `hover-translate-<版>.xpi` をダウンロードします（自分で作るときは下の「開発」の手順で `outputs/` にできます）。
2. Zotero の **ツール → プラグイン** を開きます。
3. 右上の歯車から **Install Plugin From File…**（ファイルからプラグインをインストール）を選び、xpi を指定します。
4. PDF を開き直します。設定画面に項目が出ないときは Zotero を再起動してください。

前の版の上に入れれば、そのまま置き換わります。設定とキャッシュは残ります。

## 設定

**Zotero → 設定 → Hover Translate** で設定します。

### 翻訳サービス

| 項目 | 内容 |
| --- | --- |
| 翻訳サービス | 「Google翻訳」「DeepL」「LLM API（OpenAI互換形式・ローカルLLM可）」「Claude（Anthropic API）」「Gemini（Google AI API）」のどれか |
| 翻訳元・翻訳先 | 翻訳元は「自動判定」も選べます。翻訳先の既定は日本語です（Zotero の表示言語が中国語・韓国語・ドイツ語・フランス語・スペイン語なら、その言語） |
| 接続先 | LLM API のとき。OpenAI・xAI（Grok）・DeepSeek・Mistral AI・Groq・OpenRouter・LM Studio・Ollama から選ぶと、API URL が入ります。一覧にないサービスは「その他」 |
| API URL | LLM API のとき。「その他」なら、使うサービスが案内している OpenAI 互換の URL（多くは `…/v1` で終わる形。`/chat/completions` まで書いても構いません） |
| モデル名 | LLM API のとき。サービスが決めているモデルの ID。「モデル一覧を取得」を押すと「モデルの候補」から選べます。接続先が LM Studio・Ollama のときは、自動で一覧を取ってきます（モデルが1つだけなら、その名前を自動で入れます） |
| APIキー（任意） | LLM API のとき。認証のいらないローカルサーバーなら空欄で構いません。接続先を別のサービスに変えると、モデル名とともに空になります |
| Claudeのモデル名 | Claude のとき。既定は `claude-haiku-5-5`（速くて安く、翻訳に向いています） |
| ClaudeのAPIキー | Claude のとき。[Claude Console](https://platform.claude.com/) で作った API キー |
| Geminiのモデル名 | Gemini のとき。既定は `gemini-3.5-flash-lite`（Gemini 3 世代でいちばん安いモデル） |
| GeminiのAPIキー | Gemini のとき。[Google AI Studio](https://aistudio.google.com/) で作った API キー |
| DeepLのAPIキー | DeepL のとき。DeepL のアカウントで作った API キー。Free（末尾が `:fx`）と Pro のどちらも使え、送り先は自動で切り替えます |
| 訳文の単語連動ハイライト（高負荷） | カーソルを合わせた原文の単語に対応する訳語を、ポップアップの訳文でハイライトします。LLM API・Claude・Gemini で、翻訳元が英語のときだけ使えます。モデルによっては精度が出ません |

LLM API・Claude・Gemini では、**モデル一覧を取得** を押すと、そのサービスで使えるモデルが「モデルの候補」に並び、選ぶとモデル名に入ります（Claude・Gemini は先に API キーを入れてください）。

**保存して接続テスト** を押すと、設定を保存して翻訳元の言語の例文を 1 文翻訳してみます。

### 読み取り時の動作

| 項目 | 内容 |
| --- | --- |
| ホバー翻訳を有効にする | 閲覧画面の「翻訳：オン／オフ」と同じです |
| 原文の文全体をハイライト | 翻訳中の文を原文の上でハイライトします |
| ホバーの待機時間 | カーソルを止めてから翻訳を始めるまでの時間（既定 500 ミリ秒） |
| 全文事前翻訳の同時実行数 | 1〜6 件（既定 3 件） |

### ポップアップの外観

| 項目 | 範囲 | 既定 |
| --- | --- | --- |
| 訳文の文字サイズ | 12〜32 px | 17 px |
| 最大幅 | 240〜1200 px | 640 px |
| 背景の透明度 | 0〜80% | 0%（不透明） |

「表示プレビュー」には、翻訳先の言語・単語連動ハイライトの設定に合わせたポップアップの表示例が出ます。

## 使い方

| したいこと | 操作 |
| --- | --- |
| 文を翻訳する | 英文の上でカーソルを止める |
| 同じ文を訳し直す | ポップアップの ↻、または **Ctrl+Alt+R**（macOS は **⌘+Option+R**） |
| ポップアップを閉じる | ×、**Esc**、またはページをスクロール |
| 訳文をコピーする | ポップアップにカーソルを移して選択・コピー |
| 翻訳のオン・オフや言語・モデルを変える | PDF 上部のツールバーの「翻訳設定」 |
| PDF 全体を事前に翻訳する | 「翻訳設定」の「全文翻訳」。もう一度押すとキャンセル |

## データの扱いと注意

- **送信するもの**：ホバーした文を、設定した翻訳サービスに送ります。Google 翻訳と Gemini を選ぶと原文は Google に、DeepL を選ぶと DeepL に、Claude を選ぶと Anthropic に送られます。手元だけで処理したいときは、ローカル LLM を使ってください。
- **Google 翻訳について**：キーのいらない Web 用の窓口を使っているので、利用制限や仕様の変更で使えなくなることがあります。訳文の単語連動ハイライトには対応しません。
- **API キー**：Zotero の設定に保存されます。設定ファイルを人に渡さないでください。
- **キャッシュ**：翻訳結果は PDF と同じフォルダーに JSON で保存し、再起動後も使います。翻訳サービス・モデル・翻訳元・翻訳先・単語連動の有無ごとに分けて保存します。全文事前翻訳の結果は別のファイルで、通常キャッシュの 1,000 文の上限はかかりません。
- **変更しないもの**：PDF の中身、Zotero の項目・タグ・注釈・引用キーは変更しません。
- **苦手なもの**：本文中の数式、画像だけの PDF（OCR はしません）、複雑な段組や罫線のない表、本文と同じ大きさの図中ラベルは、文の切り出しを誤ることがあります。
- **LLM API で使えるサービス**：OpenAI 互換の Chat Completions 形式（`/chat/completions` に POST し、API キーを `Authorization: Bearer` で送る形）に対応していれば、提供元は問いません。この形に対応していないサービス（独自形式の API、URL にクエリが必要な API など）は使えません。
- **Claude について**：Anthropic の Messages API を直接使います。考える量を低く（`effort: low`）指定し、訳文の JSON の形を API 側で保証させています。利用料は Claude Console のクレジットから引かれます。Max・Ultra・Team プランに付く毎月の API クレジットは、Claude Console の組織をプランにつなぐと使えます。
- **Gemini について**：Google の generateContent API を直接使います。訳文の JSON の形を API 側で保証させ、考える量はモデルの世代に合わせてできるだけ少なくしています（Gemini 3・4 は `low`、2.5 Flash は考える処理を止める。Flash-Lite と 2.5 Pro はモデルの既定のまま）。
- **DeepL について**：翻訳専用のサービスで、訳の質に定評があります。英語へ訳すときはアメリカ英語、中国語は簡体字で出力します。月ごとの文字数の上限に達すると、そのことを知らせます。
- **API キーの保存**：サービスごとに別々に保存し、選んでいるサービスにだけ送ります。
- **翻訳専用のローカルモデル（PLaMo 3 Translate）**：モデル名に `plamo` と `translate` が入っていると、そのモデル用の書式（`[plamo-translate]` で始まる設定と原文だけを送り、訳文だけを受け取る形）に自動で切り替えます。Ollama なら `ollama pull hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M` で入れ、接続先「Ollama」、モデル名 `hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M` で使えます。単語連動ハイライトには対応しません。PLaMo は PLaMo Community License で、個人・非商用の利用は無料です。
- **LLM API の接続先**：HTTPS の URL が必要です。HTTP はこの Mac の中（`localhost`・`127.0.0.1`）への接続だけ使えます。
- **LLM API の応答**：JSON で `{"translation":"訳文"}` を返すモデルが必要です。一覧から選んだ接続先には、そのサービスが案内している JSON 出力の指定（`response_format`）を付けて、形が崩れないようにしています（OpenAI・xAI・LM Studio・Ollama は JSON の形まで指定、DeepSeek・Mistral・Groq は JSON であることだけ指定、OpenRouter はモデルによって違うため指定なし）。OpenAI の考えるモデル（GPT-5 や o シリーズ）には、考える量を低くする指定も付けます。単語連動ハイライトを使うときは本家と同じ segments 形式を求めます。
- 本家や別のホバー翻訳プラグインと同時に有効にすると、ポップアップが重なることがあります。

## 開発

Node.js 24 以上と Python 3 が必要です。

```bash
npm ci --ignore-scripts
npm test
python3 scripts/build.py
```

`outputs/` に xpi と SHA-256 のチェックサムができます。テストや開発用の依存は xpi に含めません。

| ファイル | 役割 |
| --- | --- |
| `addon.js` | 閲覧画面の操作、翻訳のリクエスト、ポップアップ |
| `core.js` | 文の切り出し、単語の位置、対応関係の検査、画面の文言（日本語と英語） |
| `cache.js` | キャッシュ |
| `fulltext.js` | 全文事前翻訳の処理と進み具合 |
| `prefs.xhtml` / `prefs.js` / `prefs.css` | 設定画面（設定画面の英語の文言は `prefs.js`） |
| `tests/` | 自動テスト（キャッシュ、翻訳、模擬の閲覧画面など） |

版ごとの変更は [CHANGELOG.md](CHANGELOG.md) にあります。

## ライセンス

MIT ライセンスです（[LICENSE](LICENSE)）。元のプログラムの著作権は Sentence Hover contributors にあります。
