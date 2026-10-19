# Best Shot Picker

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-best-shot-picker/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

[English README](README.md)

似た写真を見比べてお気に入りを選び、元ファイルのままZIPで保存する、完全ローカル処理の単一HTMLアプリです。

## 🚀 デモ

### [Best Shot Pickerを開く](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

インストールやアカウント登録は不要です。最初のHTMLを読み込んだ後、写真はブラウザー内で処理され、外部へ送信されません。

[![写真の比較と選択を行うBest Shot Pickerの画面](assets/screenshot.png)](https://ttomohisa.github.io/htmlapps-best-shot-picker/)

## 主な機能

- **写真をまとめて追加:** JPEG・PNG・静止画WebPに対応。作業途中でも追加できます。
- **似た写真を整理:** 重複・類似グループを確認し、分割・移動・結合・取り消しができます。
- **細部を見比べる:** A/B比較、100%・200%・400%表示、任意の顔位置の拡大に対応します。
- **残す写真は自分で選ぶ:** 何枚でも選択でき、未確認グループを順番に確認できます。ヒントが自動で選ぶことはありません。
- **元画像のまま保存:** 1つのZIP、小分けのZIP、任意のJSON/CSV一覧を保存できます。
- **HTMLひとつで使う:** 日英切替とスマートフォン用タブを備え、コードやモデルを内包してオフラインでも使えます。

## すぐに使う

### Webで使う

最新のChromeまたはEdgeで[アプリを開く](https://ttomohisa.github.io/htmlapps-best-shot-picker/)だけです。

### ダウンロードしてオフラインで使う

1. [best-shot-picker.html](https://github.com/ttomohisa/htmlapps-best-shot-picker/blob/main/best-shot-picker.html) を開き、GitHubの **Download raw file** から保存します。
2. 保存したHTMLをブラウザーで開きます。インストールやローカルサーバーは不要です。

### 自分でビルドする

Windowsでこのリポジトリをダウンロードまたはクローンし、`build-standalone.bat` を実行します。`dist/index.html`、同じ内容のルートHTML、`dist/index.self-extract.html` を生成します。初回は固定された依存ファイルを取得する場合があります。ビルドやアプリの利用にNode.jsは不要です。

## 使い方

1. **写真を追加する。** ファイル選択、ドラッグ＆ドロップ、対応ブラウザーではフォルダー選択が使えます。追加しても選択は残ります。
2. **見比べる。** 写真を開くかAとBを選びます。スマートフォンはA／Bで切り替えます。組を変えるときは「グループ整理」を使います。
3. **お気に入りを残す。** 好きな枚数を選び、直後は「元に戻す」で取り消せます。「次の未確認グループへ」は移動だけ、「確認済みにして次へ」は確認を記録します。
4. **保存する。** 選択した写真を確認し、ZIP名を入力して保存します。ページを閉じる前に、ダウンロードしたZIPを開いて確認してください。

### 保存オプション

小分けにする場合は「小分けのZIPを1つずつ」と容量を選び、内容を確認します。1つずつ準備・ダウンロードし、保存できたことを確認してから次へ進んでください。各ZIPは単独で開けます。開始後に選択を変えた場合は、新しい保存セットを作ります。

任意のJSON/CSV一覧は別ファイルです。保存完了の証明や作業のバックアップではありません。名前に含まれる個人情報にもご注意ください。[一覧の詳細](docs/SELECTION_LIST.md)。

### 比較を助ける機能とキーボード

類似写真の検索は、自動・未確認の2組以上、合計36枚以内が対象です。候補を確認してから適用してください。「顔を探す」は検出位置を選んで拡大する機能で、人物の識別や目の開閉は判定しません。

| キー | 操作 |
| --- | --- |
| ←／→ | 操作中の写真を移動 |
| Enter | ページにフォーカスがあるとき「残す／解除」 |
| Esc | ダイアログを閉じる |
| Tabで拡大画像に入り、矢印キー | 画像内を移動 |

入力欄やボタンにフォーカスがあるときは、その通常の操作が優先されます。

## 開発と公開

`src/` と設定を編集して再ビルドします。生成HTMLは直接編集しません。ビルド検証は `scripts/check-powershell-syntax.ps1` と `scripts/check-repository.ps1` を実行してください。既存テストはNode.js 22以降で `npm ci`、`npm test`、`npm run test:grouping` を使います。ブラウザー検証は[検証記録](docs/VALIDATION.md)を参照してください。

同梱のGitHub Pagesワークフローが `main` を再ビルドして自動公開します。開発の詳細は[構成](docs/ARCHITECTURE.md)、[アプリ仕様](APP_SPEC.md)、[開発への参加](CONTRIBUTING.md)にまとめています。

## プライバシー

- 写真とモデルの処理は端末内で行います。画像送信・アクセス解析・外部AIへの通信はなく、実行時の外部通信はCSPで制限します。
- ZIPには元のバイト列を保存するため、**EXIF・GPS位置情報なども残ります**。共有前に確認してください。元ファイルの上書きや削除はしません。
- **再読み込み・ページを閉じる・「最初から」で写真と選択は消えます。** 復元機能はないため、終了前に保存してください。言語設定だけを保存する場合があります。

## 制限事項

- JPEG・PNG・静止画WebPのみ対応。HEIC/HEIF・AVIF・RAW・TIFF・アニメーション画像・動画は非対応です。
- グループ化、比較のヒント、任意モデルの候補には誤りがあります。元画像を見比べ、最後は自分で選んでください。
- 大容量の画像やZIPはメモリ不足になる場合があります。枚数やZIP容量を減らしてください。容量設定はメモリ不足を防ぐ保証ではありません。ZIP64やディスクへの直接書き込みには非対応です。
- クラウドから選んだ原本は、あとから読み取れない場合があります。端末へ保存し、**別タブ**で端末内のファイルを選んでください。選択を残すため、元のタブは閉じないでください。
- 任意の検索にはWeb Workersと `DecompressionStream` が必要です。自己展開版は起動にも `DecompressionStream` が必要なため、開けない場合は通常版HTMLを使ってください。
- Android Chromeでは端末保存写真の通常ZIP・小分けZIP保存と展開後の写真表示を確認しています。Windows／iPhone実機、大量実画像、広範な判定精度は未検証です。[対応範囲と検証の詳細](docs/VALIDATION.md)。

## ライセンスと依存ライブラリ

アプリは [MIT License](LICENSE) です。内包するTensorFlow.js、MobileNet、MediaPipe顔検出関連のライセンスはApache-2.0で、必要な告知を保持しています。[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) とアプリ内ヘルプをご確認ください。
