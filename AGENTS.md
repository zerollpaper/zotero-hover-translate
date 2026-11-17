# Hover Translate：エージェント向けの決まり

Zotero 10 用プラグイン「Hover Translate」。使い方と構成は [README.md](README.md)、変更の記録は [CHANGELOG.md](CHANGELOG.md) を見る。

## 合格条件とテスト

- 合格条件は `.agents/check.json`（`npm test`＝lint の Biome と `node --test tests/*.test.cjs`。lint は2026-11-16 に導入、設定は `biome.json`）。Stop フックが、変更があるのにテストが通らないあいだは作業を終えさせない。
- `check.json` の `locked` にあるテストと `biome.json` は保護している。動きを変えるためにどうしても書き換えるときは、理由を伝えて Satoshi の了承を得る。そのとき、コミットへのまとめも同じ流れで了承をもらい、書き換えとコミットを続けて行う（未コミットのまま終えると、保護したファイルの変更として RED になる。2026-11-16 に実際に起きた）。
- 保護していないテスト（`tests/claude.test.cjs` など）は、機能を足すときに自由に足してよい。
- `tests/reader.test.cjs` は偽の時計（`node:test` の `mock.timers`）で動く。待つときは `wait()` を使い、実時間の `setTimeout` で待たない。addon.js は vm の中で動くので、偽の `Date` は fixture の `scope` で渡している（渡さないと vm 内の本物の `Date` が使われ、45ms の間引きで動きが止まる。2026-11-17）。

## コミットと GitHub

- GitHub は `zerollpaper/zotero-hover-translate`（公開）。2026-11-17 に v1.0.0 をリリースして公開した。
- 公開後は履歴を書き換えない（`git commit --amend` や強制プッシュはしない）。変更はふつうのコミットとして足す。コミットとプッシュは Satoshi に聞いてから。
- 新しい版を出すときは、`manifest.json` の版と `CHANGELOG.md` を直し、`python3 scripts/build.py` で xpi を作って Zotero で確かめてから、`v<版>` のタグと GitHub のリリース（xpi と `SHA256SUMS.txt` を添付）を作る。

## Zotero での確認

- `python3 scripts/build.py` で `outputs/hover-translate-<版>.xpi` を作り、Zotero に入れ直してから確かめる。ファイル選択の画面（Install Plugin From File…）はエージェントから操作できないので、入れるところは Satoshi に頼む。
- 入ったかは `~/Library/Application Support/Zotero/Profiles/*/extensions/hover-translate@local.xpi` のチェックサムを `outputs/SHA256SUMS.txt` と比べて確かめる。
- 設定画面のプルダウンは、エージェントから開けないことが多い。文字の入力とボタンは操作できる。

## 翻訳サービスの仕様

- 各サービスの送り方と受け取り方は `core.js` の `serviceRequest` / `serviceText`、モデル一覧は `modelsRequest` / `modelIds` にまとめてある。サービスの API の書き方は、公式ドキュメントで確かめてから変える。
- ローカル LLM の確認には Ollama（`http://127.0.0.1:11434/v1`、モデルは `hf.co/pfnet/plamo-3-translate-2b-GGUF:Q4_K_M`）を使う。PLaMo Translate はモデル名で見分け、専用の書式で送る。
