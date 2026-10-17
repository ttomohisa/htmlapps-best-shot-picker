(() => {
  'use strict';
  const APP_CONFIG = window.StandaloneAssets.manifest.app;
  const Core = window.BestShotCore;
  const Groups = window.BestShotGrouping;
  const Quality = window.BestShotQuality;
  const Similarity = window.BestShotSimilarity;
  const FaceGeometry = window.BestShotFaceGeometry;
  const $ = selector => document.querySelector(selector);
  const translations = {
    en: {
      brandMeta:'Compare. Choose. Keep the originals.',eyebrow:'A LITTLE LESS SCROLLING. A BETTER PICK.',introTitle:'Find the photos you want to keep.',lead:'Put your shots side by side, choose your favorites, and save the originals together.',localBadge:'Fully local processing',photos:'Photos',photosHint:'Open any photo for a closer look.',add:'Add photos',clear:'Start over',dropTitle:'Drop your photos here',formats:'JPEG · PNG · still WebP',folder:'Choose a folder',emptyHint:'Nothing selected for you. Every choice is yours.',compare:'Compare',compareHint:'Choose photos A and B, then look closer.',compareEmpty:'Add a photo to start comparing.',activePhoto:'Active comparison photo',zoom:'Zoom',fit:'Fit',previous:'Previous',next:'Next',enlarge:'Open large',keyboardHint:'← → Browse the active photo · Enter Keep / unkeep · Esc Close',save:'Save',saveEmpty:'Choose photos to keep before saving.',outputFilename:'ZIP filename',metadataNote:'Original files are preserved, including any location and other metadata. Check this before sharing.',exportLimit:'Save one ZIP, or choose smaller independent ZIPs. Check each download before continuing.',download:'Save originals as ZIP',cancel:'Cancel',retry:'Retry unfinished photos',footer:'A single HTML file. No account, no upload.',navigation:'App navigation',keep:'Keep',kept:'Kept',unkeep:'Unkeep',view:'View photo',undo:'Undo',selectionChanged:'Selection updated',selected:'kept',loaded:'photos',failed:'unfinished',loading:'Reading photos',cancelled:'Cancelled. Finished photos and your choices are still here.',readFinished:'Photos are ready.',unsupported:'Use JPEG, PNG, or still WebP.',invalid:'Could not decode this image. Try another file.',animated:'Animated images are not supported.',emptyFile:'This file is empty.',largeImage:'This image exceeds the safe decode limit (100 megapixels or 32,768 pixels per side).',loadCancelled:'Not read. Retry to continue.',exporting:'Preparing ZIP',exportDone:'ZIP ready. Download started; check your browser’s downloads.',exportFailed:'Could not create the ZIP. Your choices are safe. Try a smaller selection, then save again.',zipLimit:'This selection exceeds the single ZIP limit. Choose fewer or smaller files and try again.',exportCancelled:'ZIP cancelled. Your choices are unchanged.',clearTitle:'Start a new selection?',clearMessage:'Photos and choices in this session will be cleared. Original files on your device will not change.',clearAction:'Start over',confirmTitle:'Confirm',confirmAction:'Continue',close:'Close',helpTitle:'How to use & notes',helpBasicsTitle:'Choose your favorites',helpStep1:'Add JPEG, PNG, or still WebP files. You can add more later without losing your choices. Unsupported or damaged files are listed separately.',helpStep2:'Open a photo to see it large, or select A and B for side-by-side comparison. On a phone, use A / B to switch between them. Keep any photos you want; Undo reverses the latest selection change.',helpStep3:'Open Save, review the selected photos, edit the ZIP name, and save. Only kept files are included. Files with the same name get unique names.',helpCompareTitle:'Closer inspection & keyboard',helpCompare:'Fit shows the whole image. At 100%, one image pixel uses one CSS pixel; at 200% / 400%, scroll the image to inspect details. Arrow keys browse the active photo. Enter toggles Keep when focus is on the page or image. Keyboard shortcuts do not run inside text fields or selectors. Esc closes a dialog.',helpPrivacyTitle:'Your photos stay with you',helpPrivacy:'Images are processed in this browser. This app has no image upload, analytics, or remote AI service. A hosted page needs its initial HTML download; a saved HTML file can open offline. ZIP export uses the original bytes without re-encoding or changing your source files.',helpLimitsTitle:'Supported files & limits',helpLimits:'Conservative grouping and manual selection. Technical hints are relative, uncalibrated heuristics, not a guarantee. HEIC, RAW, TIFF, animated images, and videos are not supported. Images larger than 100 megapixels or 32,768 pixels on a side are skipped. Very large ZIPs can exceed browser memory; save fewer files at a time. Similar-photo search and Find faces require Web Workers and DecompressionStream. Without them, the readable HTML still supports manual comparison, Keep, and ZIP saving. The self-extracting HTML also requires DecompressionStream just to open.',helpSessionTitle:'This is a temporary session',helpSession:'Photos, thumbnails, and choices are not saved between visits. Reloading, closing the page, or starting over clears them. Only your language choice may be stored. Save your ZIP before leaving. Cancelling a read keeps completed photos; Retry continues unfinished ones. Cancelling a ZIP keeps your selection.'
    },
    ja: {
      brandMeta:'見比べて、選んで、元のまま保存。',eyebrow:'たくさんの写真から、お気に入りを。',introTitle:'残したい一枚を、見つけよう。',lead:'写真を並べて見比べて、お気に入りを選択。元ファイルのまま、まとめて保存できます。',localBadge:'完全ローカル処理',photos:'写真',photosHint:'写真を開くと、大きく確認できます。',add:'写真を追加',clear:'最初から',dropTitle:'ここに写真をドロップ',formats:'JPEG・PNG・静止画WebP',folder:'フォルダーを選択',emptyHint:'自動では選びません。残す写真は、自分で決められます。',compare:'比較',compareHint:'AとBの写真を選んで、細部を確認。',compareEmpty:'写真を追加すると比較できます。',activePhoto:'操作する比較写真',zoom:'拡大',fit:'全体',previous:'前へ',next:'次へ',enlarge:'大きく見る',keyboardHint:'← → 操作中の写真を移動・Enter 残す／解除・Esc 閉じる',save:'保存',saveEmpty:'残す写真を選んでください。',outputFilename:'ZIPファイル名',metadataNote:'元ファイルのまま保存するため、位置情報などのメタデータも残ります。共有前にご確認ください。',exportLimit:'1つのZIP、または小分けのZIPを保存できます。各ダウンロードの保存先を確認してから進んでください。',download:'元画像をZIPで保存',cancel:'中止',retry:'未完了の写真を再試行',footer:'単一HTML・アカウント不要・写真の送信なし',navigation:'アプリ内の移動',keep:'残す',kept:'選択済み',unkeep:'解除',view:'写真を見る',undo:'元に戻す',selectionChanged:'選択を変更しました',selected:'枚選択',loaded:'枚',failed:'件未完了',loading:'写真を読み込み中',cancelled:'中止しました。読み込み済みの写真と選択は残っています。',readFinished:'写真を読み込みました。',unsupported:'JPEG・PNG・静止画WebPを選んでください。',invalid:'画像を読み込めませんでした。別のファイルでお試しください。',animated:'アニメーション画像には対応していません。',emptyFile:'空のファイルです。',largeImage:'安全な読み込み上限（1億画素・一辺32,768px）を超えています。',loadCancelled:'未読込です。再試行で続けられます。',exporting:'ZIPを作成中',exportDone:'ZIPを作成し、ダウンロードを開始しました。ブラウザーの保存状況をご確認ください。',exportFailed:'ZIPを作成できませんでした。選択は残っています。枚数を減らして再度保存してください。',zipLimit:'1つのZIPで扱える容量を超えています。選択枚数や容量を減らしてください。',exportCancelled:'ZIP作成を中止しました。選択は変更されていません。',clearTitle:'最初から始めますか？',clearMessage:'この画面の写真と選択をすべてクリアします。端末の元ファイルは変更しません。',clearAction:'最初から始める',confirmTitle:'確認',confirmAction:'続ける',close:'閉じる',helpTitle:'使い方と注意事項',helpBasicsTitle:'お気に入りを選ぶ',helpStep1:'JPEG・PNG・静止画WebPを追加します。あとから追加しても選択は残ります。非対応・破損ファイルは別に表示されます。',helpStep2:'写真を開いて大きく見るか、AとBを選んで比較します。スマートフォンはA／Bで表示を切り替えます。好きな写真を何枚でも「残す」にでき、直後は「元に戻す」で取り消せます。',helpStep3:'「保存」で選択した写真を確認し、ZIP名を変更して保存します。選択済みの元ファイルだけを入れ、同名ファイルには一意な名前を付けます。',helpCompareTitle:'拡大とキーボード',helpCompare:'「全体」は画像全体を表示します。100%は画像1画素をCSSの1pxで表示し、200%・400%では画像内をスクロールして細部を確認できます。矢印キーで操作中の写真を移動します。ページや画像にフォーカスがあるときはEnterで「残す」を切り替えます。入力欄・選択欄の編集中はショートカットを動かしません。Escでダイアログを閉じます。',helpPrivacyTitle:'写真はブラウザーの中だけ',helpPrivacy:'画像はこのブラウザー内で処理します。画像のアップロード、アクセス解析、外部AIサービスはありません。公開ページは最初のHTML取得に通信します。保存したHTMLはオフラインで利用できます。ZIPには元のバイト列を入れ、画像の再圧縮や端末上の原本の変更は行いません。',helpLimitsTitle:'対応形式と制限',helpLimits:'保守的なグループ化と手動での比較・選択に対応しています。比較のヒントは未校正の相対的な指標で、正しさを保証しません。HEIC・RAW・TIFF・アニメーション画像・動画には非対応です。1億画素または一辺32,768pxを超える画像は読み込みません。大きなZIPはブラウザーのメモリを超える場合があります。枚数を分けて保存してください。類似候補検索と顔検索にはWeb WorkersとDecompressionStream対応が必要です。利用できない場合も、通常版HTMLでは手動比較・「残す」・ZIP保存を使えます。自己展開HTMLは開くときにもDecompressionStreamが必要です。',helpSessionTitle:'作業内容は一時的です',helpSession:'写真、サムネイル、選択状態は保存されません。再読み込み、ページを閉じる、「最初から」で消えるため、終了前にZIPを保存してください。言語設定だけを保存する場合があります。読み込みを中止しても完了分は残り、「再試行」で未完了分を続けられます。ZIPを中止しても選択は残ります。'
    }
  };
  Object.assign(translations.en,{"groupView": "Photo groups", "allPhotos": "All photos", "organize": "Organize", "analyze": "Analyze again", "groupNote": "Groups suggest photos to compare. They never choose what to keep. Similar photos may remain separate.", "automatic": "Automatic", "manual": "Manual", "single": "Single", "group": "Group", "reviewed": "Reviewed", "notReviewed": "Not reviewed", "identical": "Identical files", "pending": "Not analyzed", "checked": "Bytes checked", "uniqueSize": "No equal-size candidate", "skippedLarge": "Duplicate check skipped: over 64 MB", "unavailable": "Duplicate check unavailable", "analysisFailedFile": "Duplicate check failed; retry available", "captureOriginal": "EXIF capture", "captureDigitized": "EXIF digitized", "modified": "File modified", "unknownZone": "timezone unknown", "analyzing": "Analyzing", "hashing": "Checking original bytes", "comparing": "Comparing originals", "grouping": "Grouping similar photos", "analysisDone": "Analysis finished. Review groups before keeping photos.", "analysisCancelled": "Analysis cancelled. Photos, groups, and choices are unchanged. Analyze again to continue.", "analysisFailed": "Analysis failed. Your photos and choices are safe; try again.", "regroup": "Reset manual grouping and regroup", "regroupTitle": "Reset manual grouping?", "regroupMessage": "Rebuild all groups, including your manual changes. Kept photos and originals will not change. Cancelling analysis preserves the existing groups.", "groupChanged": "Groups updated", "duplicateWarning": "Your selection includes identical originals. All selected copies will be included with unique filenames.", "organizeHint": "Split one photo, move it to another group, or merge whole groups. These actions do not change Keep selections.", "sourceGroup": "Source group", "targetGroup": "Destination group", "photoToMove": "Photo to split or move", "splitPhoto": "Split into a single", "movePhoto": "Move photo", "mergeGroups": "Merge groups", "toggleReviewed": "Toggle reviewed", "helpGroups": "Groups use exact original bytes, conservative visual similarity, and JPEG EXIF capture/digitized time when available. File modified time is shown separately and never treated as capture time. Use Photo groups to filter Photos and Compare. Organize can split, move, merge, or mark a group reviewed, even with none kept. Undo reverses the latest group edit. Manual groups stay intact when more photos are added. Reset manual grouping rebuilds them but preserves Keep selections. Identical-file badges remain even after splitting. Missing timestamps or unavailable analysis do not prevent selection or export. Duplicate hashing is limited to 64 MB per file; unusually large originals remain usable. Similarity is only a suggestion and can be wrong."});
  Object.assign(translations.ja,{"groupView": "写真のグループ", "allPhotos": "すべての写真", "organize": "グループ整理", "analyze": "再解析", "groupNote": "比較する写真の候補をまとめます。残す写真は自動で選びません。似た写真も別の組に残ることがあります。", "automatic": "自動", "manual": "手動", "single": "単独", "group": "グループ", "reviewed": "確認済み", "notReviewed": "未確認", "identical": "同一バイト", "pending": "未解析", "checked": "バイト確認済み", "uniqueSize": "同サイズ候補なし", "skippedLarge": "重複確認を省略：64 MB超", "unavailable": "重複確認を利用できません", "analysisFailedFile": "重複確認失敗・再試行できます", "captureOriginal": "EXIF撮影日時", "captureDigitized": "EXIFデジタル化日時", "modified": "ファイル更新日時", "unknownZone": "タイムゾーン不明", "analyzing": "解析中", "hashing": "元ファイルを確認中", "comparing": "バイトを照合中", "grouping": "似た写真を整理中", "analysisDone": "解析が終わりました。グループを確認して、残す写真を選んでください。", "analysisCancelled": "解析を中止しました。写真、グループ、選択は変わりません。「再解析」で続けられます。", "analysisFailed": "解析できませんでした。写真と選択は残っています。もう一度お試しください。", "regroup": "手動の分類をリセットして再分類", "regroupTitle": "手動の分類をリセットしますか？", "regroupMessage": "手動で変更した組を含め、すべてのグループを作り直します。残す写真と原本は変わりません。解析を中止すると現在のグループが残ります。", "groupChanged": "グループを変更しました", "duplicateWarning": "同一内容の元ファイルが複数選択されています。選択したコピーはすべて別名でZIPに入ります。", "organizeHint": "写真を単独に分割、別グループへ移動、またはグループ同士を結合できます。「残す」の選択は変わりません。", "sourceGroup": "操作するグループ", "targetGroup": "移動・結合先のグループ", "photoToMove": "分割・移動する写真", "splitPhoto": "単独に分割", "movePhoto": "写真を移動", "mergeGroups": "グループを結合", "toggleReviewed": "確認済みを切り替え", "helpGroups": "元ファイルの厳密なバイト一致、保守的な見た目の類似度、取得できるJPEGのEXIF撮影・デジタル化日時からグループを作ります。ファイル更新日時は別表示し、撮影日時とは扱いません。「写真のグループ」で一覧と比較を絞り込めます。「グループ整理」で分割・移動・結合・確認済みの切替ができ、残す写真が0枚でも確認済みにできます。直後は「元に戻す」で取り消せます。写真を追加しても手動で編集した組は保たれます。「手動の分類をリセット」は組を作り直しますが、残す選択は変えません。同一バイトの表示は分割後も残ります。日時なし・解析不能でも選択と保存は可能です。64 MBを超えるファイルは重複確認を省略しますが、写真として利用できます。類似グループは参考で、誤りを含むことがあります。"});
  Object.assign(translations.en,{optionalUnavailable:'This browser cannot run optional photo searches. You can still compare photos, choose Keep, and save originals.',licenseLoading:'Opening bundled license text…',licenseFailed:'License text could not be opened. Try again. Your photos and choices are unchanged.',licenseRetry:'Retry license text'});
  Object.assign(translations.ja,{optionalUnavailable:'このブラウザーでは任意の写真検索を利用できません。通常の比較、「残す」の選択、元画像の保存は使えます。',licenseLoading:'同梱ライセンスを開いています…',licenseFailed:'ライセンスを開けませんでした。再試行してください。写真と選択は変わりません。',licenseRetry:'ライセンスを再試行'});
  Object.assign(translations.en,{zipMode:'Save as',zipSingle:'One ZIP',zipBatches:'Smaller ZIPs, one at a time',zipBatchSize:'Maximum size per ZIP',zipChooseSize:'Choose a size',zipBudgetNote:'This limits each ZIP, not total browser memory. Choose a smaller size if saving fails.',zipPlan:'Review ZIP plan',zipSnapshot:'This plan uses the photos kept when you started it. Later Keep changes apply only to a new plan.',zipPlanLabel:'Planned selection',zipArchives:'ZIP files',zipPrepare:'Prepare this ZIP',zipReady:'ZIP ready. Download it, then check that your browser saved it.',zipRequested:'Download requested. Check the saved file before continuing. This page cannot confirm disk completion.',zipDownload:'Download this ZIP',zipDownloadAgain:'Download this ZIP again',zipDuplicateNote:'Downloading again may create another copy. It does not repeat earlier ZIPs.',zipNext:'Saved; next ZIP',zipFinish:'Saved; finish',zipClose:'End this plan',zipCloseTitle:'End this ZIP plan?',zipCloseMessage:'Check that the current download has finished first. Ending the plan releases its download link. Files already saved and your Keep choices remain.',zipPreviousDownload:'Check that your previous ZIP download has finished before continuing. Its old download link will be released.',zipCancelled:'Preparation stopped. Retry this same ZIP when ready. Earlier ZIPs are not repeated.',zipFailed:'Could not prepare this ZIP. Retry it, or end the plan and choose a smaller size. Your photos and choices are unchanged.',zipTooLarge:'This file cannot fit the chosen ZIP size:',zipTooLargeHelp:'Choose a larger size, adjust Keep, or switch to One ZIP within its limits. The original will not be split.',zipPlanInvalid:'Choose a size and at least one kept photo, then try again.',zipConfirmed:'You confirmed all ZIPs in this plan were saved. Check your downloads before closing this page.',zipPart:'ZIP',zipFiles:'photos',zipBytes:'bytes',helpZipBatches:'For smaller downloads, choose Smaller ZIPs, choose a maximum size, and review the plan. Each ZIP opens on its own. Prepare and download one ZIP, check the saved file, then choose Saved; next ZIP. The plan keeps the selection and names from when it started; later Keep changes need a new plan. Cancel stops preparation, and retry repeats only the current ZIP. Download again can create another copy. The page cannot confirm disk completion or free space. A photo larger than the chosen size is reported before preparation; choose a larger size or adjust your selection. The size setting does not guarantee device memory safety.'});
  Object.assign(translations.ja,{zipMode:'保存方法',zipSingle:'1つのZIP',zipBatches:'小分けのZIPを1つずつ',zipBatchSize:'ZIP1つの上限容量',zipChooseSize:'容量を選ぶ',zipBudgetNote:'各ZIPの容量を制限します。ブラウザー全体のメモリ上限ではありません。保存できない場合は小さい容量を選んでください。',zipPlan:'ZIPの内容を確認',zipSnapshot:'この保存セットは開始時の「残す」の選択を使います。あとから変えた選択は、新しい保存セットに反映されます。',zipPlanLabel:'この保存セット',zipArchives:'個のZIP',zipPrepare:'このZIPを準備',zipReady:'ZIPを準備しました。ダウンロード後、ブラウザーで保存できたことを確認してください。',zipRequested:'ダウンロードを開始しました。保存先を確認してから進んでください。この画面では保存完了を確認できません。',zipDownload:'このZIPをダウンロード',zipDownloadAgain:'このZIPを再ダウンロード',zipDuplicateNote:'再ダウンロードすると同じZIPがもう1つ保存される場合があります。前のZIPは繰り返しません。',zipNext:'保存を確認して次のZIPへ',zipFinish:'保存を確認して終了',zipClose:'この保存セットを終了',zipCloseTitle:'保存セットを終了しますか？',zipCloseMessage:'現在のダウンロードが終わったことを先に確認してください。終了するとダウンロード用リンクを解放します。保存済みファイルと「残す」の選択は変わりません。',zipPreviousDownload:'前のZIPのダウンロードが終わったことを確認してから進んでください。以前のダウンロード用リンクを解放します。',zipCancelled:'準備を中止しました。同じZIPから再試行できます。前のZIPは繰り返しません。',zipFailed:'このZIPを準備できませんでした。再試行するか、保存セットを終了して容量を小さくしてください。写真と選択は変わりません。',zipTooLarge:'選んだZIP容量に収まらないファイル：',zipTooLargeHelp:'容量を大きくするか「残す」を調整するか、上限に収まる範囲で「1つのZIP」に切り替えてください。原本を分割することはありません。',zipPlanInvalid:'容量と「残す」写真を選んで、もう一度お試しください。',zipConfirmed:'この保存セットの全ZIPについて、保存を確認しました。ページを閉じる前に保存先をご確認ください。',zipPart:'ZIP',zipFiles:'枚',zipBytes:'バイト',helpZipBatches:'小分けに保存するには「小分けのZIPを1つずつ」と容量を選び、内容を確認します。ZIPはそれぞれ単独で開けます。1つずつ準備・ダウンロードし、保存できたことを確認してから次へ進んでください。開始時の選択と名前を使うため、あとから「残す」を変えた場合は新しい保存セットを作ってください。中止は準備を停止し、再試行は現在のZIPだけを準備します。再ダウンロードは同じコピーが増える場合があります。この画面では保存完了や空き容量を確認できません。1枚が指定容量を超える場合は準備前に案内するので、容量を大きくするか選択を調整してください。容量設定は端末のメモリ不足を防ぐ保証ではありません。'});
  Object.assign(translations.en,{selectionListTitle:'Save a selected-file list',selectionListNote:'Optional list of planned files, not proof they were saved. Names may contain personal information. The list is downloaded separately and is not added to ZIPs.',selectionListCurrent:'Uses your current Keep choices when you download the list.',selectionListBatch:'Uses this ZIP plan’s starting selection, even if you change Keep later.',selectionListNeedPlan:'Review a smaller-ZIP plan first, or switch to One ZIP.',selectionListName:'List filename',selectionListJson:'Download JSON list',selectionListCsv:'Download CSV list',selectionListFormat:'JSON keeps exact original names. CSV uses “file: ” display names and visible escapes for control characters, for viewing in spreadsheets.',selectionListDone:'List download requested. Check your browser’s downloads. This is a planned list, not a saved-file receipt.',selectionListFailed:'Could not create the list. Your photos and choices are unchanged.',selectionListLimit:'This selection exceeds one ZIP’s limits. Review a smaller-ZIP plan to list its parts.'});
  Object.assign(translations.ja,{selectionListTitle:'保存対象の一覧を保存',selectionListNote:'保存予定の一覧です。保存完了の証明ではありません。名前には個人情報が含まれる場合があります。一覧は別ファイルで保存し、ZIPには追加しません。',selectionListCurrent:'一覧をダウンロードした時点の「残す」の選択を使います。',selectionListBatch:'このZIP保存セットの開始時の選択を使います。あとから「残す」を変えても内容は変わりません。',selectionListNeedPlan:'先に小分けZIPの内容を確認するか、「1つのZIP」に切り替えてください。',selectionListName:'一覧のファイル名',selectionListJson:'JSON一覧をダウンロード',selectionListCsv:'CSV一覧をダウンロード',selectionListFormat:'JSONは元の名前を正確に保持します。表計算向けのCSVは名前に「file: 」を付け、制御文字を見える表記にします。',selectionListDone:'一覧のダウンロードを開始しました。ブラウザーの保存先をご確認ください。保存予定の一覧であり、保存済みの証明ではありません。',selectionListFailed:'一覧を作成できませんでした。写真と選択は変わりません。',selectionListLimit:'1つのZIPの上限を超えています。小分けZIPの内容を確認すると、その保存先を一覧にできます。'});
  const storageKeys = { language: 'best-shot-picker.language' };
  let language = readStorage(storageKeys.language) || detectLanguage();
      // Reusable Promise-based confirmation API. Canonical source: components/confirm-dialog.html.
      const AppConfirm = (() => {
        const dialog = $('#appConfirmDialog');
        const title = $('#appConfirmTitle');
        const message = $('#appConfirmMessage');
        const closeButton = $('#appConfirmClose');
        const cancelButton = $('#appConfirmCancel');
        const okButton = $('#appConfirmOk');
        let resolver = null;
        let restoreFocus = null;

        function finish(result) {
          if (!dialog.open) return;
          const currentResolver = resolver;
          resolver = null;
          dialog.close();
          if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected) restoreFocus.focus({ preventScroll: true });
          restoreFocus = null;
          if (currentResolver) currentResolver(result);
        }

        function ask({ title: heading, message: body, confirmLabel, cancelLabel, tone = 'default' } = {}) {
          if (dialog.open) finish(false);
          title.textContent = heading || translate('confirmTitle');
          message.textContent = body || '';
          cancelButton.textContent = cancelLabel || translate('cancel');
          okButton.textContent = confirmLabel || translate('confirmAction');
          okButton.classList.toggle('danger', tone === 'danger');
          okButton.classList.toggle('primary', tone !== 'danger');
          restoreFocus = document.activeElement;
          return new Promise(resolve => {
            resolver = resolve;
            dialog.showModal();
            requestAnimationFrame(() => cancelButton.focus({ preventScroll: true }));
          });
        }

        closeButton.addEventListener('click', () => finish(false));
        cancelButton.addEventListener('click', () => finish(false));
        okButton.addEventListener('click', () => finish(true));
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        dialog.addEventListener('click', event => {
          const rect = dialog.getBoundingClientRect();
          const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
          if (outside) finish(false);
        });

        return Object.freeze({ ask });
      })();
      window.AppConfirm = AppConfirm;

      function readStorage(key) {
        try { return localStorage.getItem(key); } catch { return null; }
      }
      function writeStorage(key, value) {
        try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable in private contexts. */ }
      }
      function detectLanguage() {
        if (APP_CONFIG.defaultLanguage === 'ja' || APP_CONFIG.defaultLanguage === 'en') return APP_CONFIG.defaultLanguage;
        return (navigator.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
      }
      function translate(key) { return translations[language]?.[key] ?? translations.en[key] ?? key; }

      // Reusable toast / Undo API. Canonical source: components/toast.html.
      const AppToast = (() => {
        const root = $('#appToast');
        const message = $('#appToastMessage');
        const action = $('#appToastAction');
        let timer = 0;
        let actionHandler = null;
        let restoreFocus = null;
        function dismiss() {
          const hadFocus = document.activeElement === action;
          clearTimeout(timer);
          timer = 0;
          root.classList.remove('show');
          action.hidden = true;
          actionHandler = null;
          if (hadFocus && restoreFocus) restoreFocus();
          restoreFocus = null;
        }
        function show({ message: text = '', actionLabel = '', onAction = null, onRestoreFocus = null, duration = 3200, tone = 'default' } = {}) {
          clearTimeout(timer);
          message.textContent = String(text);
          root.dataset.tone = tone;
          restoreFocus = onRestoreFocus;
          actionHandler = typeof onAction === 'function' ? onAction : null;
          action.textContent = actionLabel || '';
          action.hidden = !actionHandler || !actionLabel;
          root.classList.add('show');
          if (duration > 0) timer = window.setTimeout(dismiss, duration);
          return Object.freeze({ dismiss });
        }
        action.addEventListener('click', () => {
          const handler = actionHandler;
          dismiss();
          if (handler) handler();
        });
        return Object.freeze({ show, dismiss });
      })();
      window.AppToast = AppToast;
      function showToast(message, options = {}) { $('#appToast').dataset.messageKey=options.messageKey||'selectionChanged';AppToast.show({ message, ...options }); }
  Object.assign(translations.en,{"qualityTitle":"Technical comparison hints","qualityNote":"Hints compare reduced previews within a group. They never choose photos for you.","qualityCandidate":"Comparison candidate","qualityNone":"No recommendation — compare and choose yourself.","qualityPending":"Technical hints are not available yet. Analyze again to try.","qualityIncomparable":"No recommendation: the images are not comparable enough.","qualityUncertain":"No recommendation: the measurements are uncertain.","qualityTie":"No recommendation: there is no clear technical difference.","qualitySingle":"A single photo needs no relative ranking.","qualityFailed":"Technical measurement unavailable; comparison and saving still work.","qualityCount":"groups with a comparison candidate","qualityCountSingle":"group with a comparison candidate","qualityMeasuring":"Measuring preview detail and light","qualityDetail":"Stronger detail signal in the reduced preview","qualityHighlight":"Fewer near-white pixels in the reduced preview","qualityHighlights":"Near-white pixels","qualityDarks":"Near-black pixels","helpQuality":"Technical hints compare reduced previews in the same group, using detail and near-white pixel measurements. A candidate is never kept automatically. Similar results, uncertain measurements, different scenes, and missing measurements may produce no recommendation. Noise, intentional background blur, line art, and lighting can mislead these measurements. Dark pixels are reported, not treated as a bad photo. Hints do not judge faces, expression, composition, or personal value. Always inspect the originals and choose for yourself."});
  Object.assign(translations.ja,{"qualityTitle":"技術的な比較のヒント","qualityNote":"同じ組の縮小画像を比べた参考情報です。残す写真は自動で選びません。","qualityCandidate":"比較の候補","qualityNone":"おすすめなし。見比べて選んでください。","qualityPending":"比較のヒントは未計測です。「再解析」で試せます。","qualityIncomparable":"おすすめなし。画像の条件が異なるため比較を控えています。","qualityUncertain":"おすすめなし。計測結果が不確かです。","qualityTie":"おすすめなし。技術的な差がはっきりしません。","qualitySingle":"1枚の写真には相対的な順位を付けません。","qualityFailed":"技術指標を計測できませんでした。比較・保存は利用できます。","qualityCount":"組に比較の候補","qualityCountSingle":"組に比較の候補","qualityMeasuring":"縮小画像の細部と明るさを計測中","qualityDetail":"縮小画像の細部指標が高め","qualityHighlight":"縮小画像の白に近い画素が少なめ","qualityHighlights":"白に近い画素","qualityDarks":"黒に近い画素","helpQuality":"同じ組の縮小画像について、細部の指標や白に近い画素の割合を比べて参考候補を示します。候補を自動で「残す」にすることはありません。差が小さい、不確か、別シーン、未計測の写真を含む場合などはおすすめを控えます。ノイズ、意図した背景ボケ、線画、光の条件によって指標は誤解を招くことがあります。黒に近い画素の割合は情報として示し、暗い写真という理由だけで低評価にしません。顔・表情・構図の好みや写真の価値は判定しません。元画像を見比べて選んでください。"});
  Object.assign(translations.en,{"modelLicenses":"Software and model licenses", "similarityTitle": "Similar-photo candidates · Experimental", "similarityFind": "Find similar-photo candidates", "similarityNote": "Candidates can include unrelated photos. Compare them before applying. Your Keep choices stay yours.", "similarityLimit": "Search 2 or more whole automatic, unreviewed groups, up to 36 photos at a time. Processing may be slow on some devices.", "similarityTooMany": "Choose which groups to search, up to 36 photos at a time. Normal comparison and saving remain available.", "similarityTooFew": "Search needs at least two automatic, unreviewed groups. Manual and reviewed groups are left alone.", "similarityLoading": "Preparing local model", "similarityFinding": "Finding candidates", "similarityApply": "Apply this grouping", "similarityDismiss": "Dismiss candidates", "similarityReady": "Review the photos, then apply one grouping if it looks right.", "similarityNone": "No additional candidates found. Existing groups are unchanged.", "similarityCancelled": "Search cancelled. Groups and Keep choices are unchanged.", "similarityFailed": "Search could not finish. Existing groups and Keep choices are safe; you can try again.", "similarityChanged": "Photos or groups changed. Search again for current candidates.", "similarityApplied": "Grouping applied. Keep choices are unchanged. Search again for more candidates.", "helpSimilarity": "Find similar-photo candidates runs an optional local model. Choose search groups to select 2 or more whole automatic, unreviewed groups, up to 36 photos per search. Larger sets open this chooser first. Groups over 36 photos cannot be searched; manual, reviewed and unanalyzed groups are excluded. Results can include unrelated photos: open the thumbnails to compare, then apply a grouping yourself. Applying does not change Keep choices or originals; Undo reverses the grouping. Adding photos, analyzing again or editing groups clears the search scope and candidates. Choose groups again for another batch. Cancel leaves groups unchanged. Processing can be slow on some devices; normal comparison and saving remain available."});
  Object.assign(translations.ja,{"modelLicenses":"ソフトウェアとモデルのライセンス", "similarityTitle": "似た写真の候補・試験的機能", "similarityFind": "似た写真の候補を探す", "similarityNote": "関係のない写真が候補に入ることがあります。適用前に見比べてください。「残す」の選択は変わりません。", "similarityLimit": "自動・未確認のグループを2組以上、合計36枚以内で検索できます。端末によって時間がかかることがあります。", "similarityTooMany": "検索するグループを合計36枚以内で選んでください。通常の比較・保存はそのまま使えます。", "similarityTooFew": "自動・未確認のグループが2組以上必要です。手動・確認済みのグループは対象にしません。", "similarityLoading": "端末内のモデルを準備中", "similarityFinding": "候補を検索中", "similarityApply": "この組み合わせを適用", "similarityDismiss": "候補を閉じる", "similarityReady": "写真を見比べ、よい組み合わせだけを適用してください。", "similarityNone": "追加の候補は見つかりませんでした。グループは変わりません。", "similarityCancelled": "検索を中止しました。グループと「残す」の選択は変わりません。", "similarityFailed": "検索を完了できませんでした。グループと選択は残っています。もう一度お試しください。", "similarityChanged": "写真またはグループが変わりました。もう一度検索してください。", "similarityApplied": "組み合わせを適用しました。「残す」の選択は変わりません。ほかの候補は再検索してください。", "helpSimilarity": "「似た写真の候補を探す」は、端末内のモデルを使う任意の機能です。「検索するグループを選ぶ」で、自動・未確認の組を丸ごと2組以上、合計36枚以内で選べます。対象が36枚を超えると、先に選択画面が開きます。1組だけで36枚を超える組、手動・確認済み・未解析の組は検索できません。関係のない写真が候補に入ることもあるため、サムネイルを開いて見比べ、適用する組み合わせを自分で選んでください。適用しても「残す」の選択や元画像は変わりません。「元に戻す」でグループを戻せます。写真の追加・再解析・グループの編集で検索範囲と候補は消えます。別の範囲はグループを選び直して検索してください。中止してもグループは変わりません。端末によって処理に時間がかかりますが、通常の比較・保存は利用できます。"});
  Object.assign(translations.en,{similarityChooseGroups:'Choose search groups',similarityScopeHint:'Select at least 2 whole groups, up to 36 photos total. Manual, reviewed and unanalyzed groups are excluded.',similarityScopeSearch:'Search',similarityScopePhotos:'photos',similarityScopeGroups:'groups',similarityScopeSelected:'Search scope',similarityScopeTooLarge:'Over 36 photos in this group. Compare and save as usual.',similarityScopeNeedGroups:'Select at least 2 groups.',similarityScopeOverLimit:'Select no more than 36 photos.',similarityScopeEmpty:'No eligible groups to search.'});
  Object.assign(translations.ja,{similarityChooseGroups:'検索するグループを選ぶ',similarityScopeHint:'グループを丸ごと2組以上、合計36枚以内で選んでください。手動・確認済み・未解析の組は対象外です。',similarityScopeSearch:'検索する',similarityScopePhotos:'枚',similarityScopeGroups:'組',similarityScopeSelected:'検索範囲',similarityScopeTooLarge:'1組で36枚を超えています。通常の比較・保存は利用できます。',similarityScopeNeedGroups:'2組以上を選んでください。',similarityScopeOverLimit:'合計36枚以内で選んでください。',similarityScopeEmpty:'検索できるグループがありません。'});
  Object.assign(translations.en,{faceFind:'Find faces · Experimental',faceTitle:'Face-position zoom · Experimental',faceNote:'Only photos A and B. Choose a face in each photo independently.',faceLoading:'Preparing face finder',faceFinding:'Finding face positions',faceReady:'Choose a face below to look closer.',faceChoose:'Numbers are local to this photo; they do not match people across photos.',faceNone:'No face found. Whole-image and manual zoom still work.',faceLabel:'Face',faceWhole:'Whole image',faceChoices:'Faces in this photo',faceCancelled:'Face search cancelled. You can try again.',faceFailed:'Face search could not finish. Try again, or use manual zoom.',helpFaces:'In Compare, Find faces runs only when you ask, for the current A and B photos. Choose Face 1–6 independently below each photo to zoom around a detected position. Whole image returns that photo to fit; the Zoom selector returns both photos to manual zoom. Changing either photo clears face results. Cancel stops the search; try Find faces again to retry. Positions can be wrong or missed, especially small, turned or partly hidden faces. Processing can be slow on some devices. Face numbers do not identify or match people. This feature does not judge eyes, expression, sharpness or which photo to keep, and does not change groups, Keep choices or original files.'});
  Object.assign(translations.ja,{faceFind:'顔を探す・試験的機能',faceTitle:'顔の位置を拡大・試験的機能',faceNote:'AとBの写真だけが対象です。それぞれの写真で顔を選べます。',faceLoading:'顔を探す準備中',faceFinding:'顔の位置を検出中',faceReady:'各写真の下で顔を選ぶと拡大できます。',faceChoose:'番号は写真ごとに付きます。写真間で同じ人物を示すものではありません。',faceNone:'顔が見つかりませんでした。全体表示と手動の拡大は利用できます。',faceLabel:'顔',faceWhole:'全体を表示',faceChoices:'この写真の顔',faceCancelled:'顔の検索を中止しました。もう一度試せます。',faceFailed:'顔の検索を完了できませんでした。再試行するか、手動で拡大してください。',helpFaces:'比較画面の「顔を探す」を押したときだけ、現在のAとBの写真を検索します。各写真の下で「顔1〜6」を個別に選ぶと、その位置の周囲を拡大します。「全体を表示」でその写真を全体表示に戻し、「拡大」の選択欄を変えると両方の写真が手動の拡大に戻ります。どちらかの写真を変えると顔の結果は消えます。「中止」で停止し、「顔を探す」で再試行できます。小さい顔、横向き、一部が隠れた顔などでは、位置の誤りや見落としがあります。端末によって処理に時間がかかります。番号は人物の識別や写真間の照合ではありません。目・表情・鮮明さ・残す写真は判定せず、グループ・「残す」の選択・元ファイルを変更しません。'});
  const state = { selectionListUrls:new Set(), selectionListDownloading:false, selectionListStatus:'', ordinaryDownloadPending:false, zipBatches:null, zipPlanning:false, zipPlanError:null, modelLicenses:{phase:'idle',text:''}, faceJob:null, faceRevision:0, facePair:[null,null], faceResults:new Map(), faceSelected:[null,null], faceWhole:[false,false], faceMessage:'', similarity:null, similarityScope:null, similarityScopeDraft:null, similarityProposals:[], similarityMessage:'', qualityResults: new Map(), groups: [], groupFilter: '', analysis: null, inputRevision: 0, groupingRevision: 0, analysisMessage: '', photos: [], failures: [], queue: [], generation: 0, nextId: 1, load: null, exporting: null, pair: [null,null], active: 0, previewId: null, previewIds: [], fullUrls: new Map(), downloadUrls: new Set() };
  const outputFilename = $('#outputFilename');
  const defaultZipName = () => `best-shot-picker-${new Date().toLocaleDateString('sv-SE').replaceAll('-','')}`;
  outputFilename.value = defaultZipName();
  $('#selectionListName').value=defaultZipName();
  const mobile = window.AppMobileBottomBar.mount($('#appMobileBottomBar'), { initialPage: 'photos', pageTopOffset: 76 });
  const ready = () => state.photos;
  const kept = () => ready().filter(photo => photo.kept);
  // Session-owned indexes avoid a linear photo search inside every group/card row.
  const photoIndex=new Map(),photoGroups=new Map(),groupPositions=new Map(),cardViews=new Map();
  let keyedRows=new WeakMap(),qualityViews=new WeakMap();
  const byId = id => photoIndex.get(id);
  // Presence checks only: do not inflate assets or start a probe worker.
  function canRunOptionalModels() {
    return typeof window.Worker==='function'&&typeof window.DecompressionStream==='function';
  }
  function syncKeyedChildren(parent,entries,keyOf,create,update){
    let rows=keyedRows.get(parent);if(!rows){parent.replaceChildren();rows=new Map();keyedRows.set(parent,rows);}
    const keys=new Set(entries.map(keyOf));
    for(const [key,node] of rows){if(!keys.has(key)){node.remove();rows.delete(key);}}
    entries.forEach((entry,index)=>{
      const key=keyOf(entry);let node=rows.get(key);
      // A reset may remove nodes outside this helper. Never reuse their handlers.
      if(!node||node.parentNode!==parent){node=create(entry,key);rows.set(key,node);}
      update(node,entry,key);
      if(parent.children[index]!==node)parent.insertBefore(node,parent.children[index]||null);
    });
  }
  function setTextIfChanged(node,text){if(node.textContent!==text)node.textContent=text;}
  function setAttributeIfChanged(node,name,value){value=String(value);if(node.getAttribute(name)!==value)node.setAttribute(name,value);}

  const sizeText = bytes => new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(bytes >= 1048576 ? bytes/1048576 : bytes/1024)+(bytes >= 1048576 ? ' MB':' KB');
  const summary = () => `${ready().length} ${translate('loaded')} · ${kept().length} ${translate('selected')}`;
  function el(tag, className, text) { const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node; }
  function applyLanguage() {
    document.documentElement.lang=language;
    document.title=language==='ja'?'ベストショット選び — Best Shot Picker':'Best Shot Picker';
    document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=translate(node.dataset.i18n));
    document.querySelectorAll('[data-i18n-title]').forEach(node=>node.title=translate(node.dataset.i18nTitle));
    document.querySelectorAll('[data-i18n-aria-label]').forEach(node=>node.setAttribute('aria-label',translate(node.dataset.i18nAriaLabel)));
    $('#languageButton').textContent=language==='ja'?'EN':'JA';
    $('#languageButton').setAttribute('aria-label',language==='ja'?'英語に切り替え':'Switch to Japanese');
    const exportMessage = $('#exportResult').dataset.messageKey;
    if(exportMessage)$('#exportResult').textContent=translate(exportMessage);
    if($('#appToast').classList.contains('show')&&!$('#appToastAction').hidden){$('#appToastMessage').textContent=translate($('#appToast').dataset.messageKey||'selectionChanged');$('#appToastAction').textContent=translate('undo');}
    render();renderModelLicenses();if($('#similarityScopeDialog').open)renderSimilarityScope();
  }
  function revealToast(){const action=$('#appToastAction');(action.hidden?$('#appToast'):action).scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});}
  function selectPhoto(photo, source = 'compare') {
    if(!photo)return;
    const toast = $('#appToast');
    $('#toastHost').append(toast); // Keep the reusable node outside replaceable lists.
    const previous=photo.kept;photo.kept=!previous;render();
    const host = $('#previewDialog').open ? $('#previewToastHost') : source === 'grid' ? $(`#photo-${photo.id} .photo-info`) : source === 'save' ? $('#saveToastHost') : document.querySelector(`[data-slot="${state.active}"]`);
    host.append(toast);
    const focusSelection = () => { const control = $('#previewDialog').open ? $('#previewKeep') : toast.parentElement.querySelector('.keep-button') || ($('#selectedList button')) || $('#clearButton'); control?.focus({preventScroll:true}); };
    const generation=state.generation;
    showToast(translate('selectionChanged'),{actionLabel:translate('undo'),duration:7000,onRestoreFocus:focusSelection,onAction:()=>{if(generation!==state.generation||!byId(photo.id))return;photo.kept=previous;render();focusSelection();}});
    revealToast();
  }
  function renderGrid() {
    const grid=$('#photoGrid'),filter=state.groups.find(g=>g.id===state.groupFilter),visible=filter?new Set(filter.ids):null;
    for(const photo of ready()){
      let view=cardViews.get(photo.id);
      if(!view){
        const card=el('article','photo-card');card.id=`photo-${photo.id}`;
        const open=el('button','photo-open');open.type='button';open.dataset.id=photo.id;
        const image=el('img');image.src=photo.thumbnailUrl;image.alt='';image.loading='lazy';open.append(image);open.addEventListener('click',event=>openPreview(photo.id,event.currentTarget,comparisonPhotos()));
        const info=el('div','photo-info'),name=el('span','photo-name',photo.name),details=el('p','photo-details'),keep=el('button','button keep-button'),quality=el('p','photo-quality'),analysis=el('p','photo-analysis');
        name.title=photo.name;keep.type='button';keep.addEventListener('click',()=>selectPhoto(photo,'grid'));info.append(name,details,keep,quality,analysis);card.append(open,info);grid.append(card);
        view={card,open,details,keep,quality,analysis,language:null,kept:null,status:null};cardViews.set(photo.id,view);
      }
      const languageChanged=view.language!==language,hidden=!!visible&&!visible.has(photo.id);
      if(view.card.hidden!==hidden)view.card.hidden=hidden;
      if(languageChanged||view.status!==photo.duplicateStatus){setTextIfChanged(view.analysis,photoAnalysisLabel(photo));view.status=photo.duplicateStatus;}
      renderPhotoQuality(view.quality,photo);
      if(languageChanged){setAttributeIfChanged(view.open,'aria-label',`${translate('view')}: ${photo.name}`);setTextIfChanged(view.details,`${photo.width} × ${photo.height} · ${sizeText(photo.size)}`);}
      if(languageChanged||view.kept!==photo.kept){view.card.classList.toggle('kept',photo.kept);setTextIfChanged(view.keep,translate(photo.kept?'kept':'keep'));setAttributeIfChanged(view.keep,'aria-pressed',photo.kept);setAttributeIfChanged(view.keep,'aria-label',`${translate(photo.kept?'unkeep':'keep')}: ${photo.name}`);view.kept=photo.kept;}
      view.language=language;
    }
  }
  function getFullUrl(photo) { if(!state.fullUrls.has(photo.id))state.fullUrls.set(photo.id,URL.createObjectURL(photo.file));return state.fullUrls.get(photo.id); }
  function releaseUnusedFullUrls() { const live=new Set([...state.pair,state.previewId]);for(const[id,url]of state.fullUrls){if(!live.has(id)){URL.revokeObjectURL(url);state.fullUrls.delete(id);}} }
  function zoomImage(img, viewport, photo, value) { viewport.classList.toggle('zoomed',value!=='fit');img.style.width=value==='fit'?'':`${photo.width*Number(value)}px`;img.style.height=value==='fit'?'':`${photo.height*Number(value)}px`; }
  function renderCompare() {
    const candidates=comparisonPhotos();$('#compareGroupLabel').textContent=state.groupFilter?groupLabel(state.groups.find(g=>g.id===state.groupFilter)):translate('allPhotos');
    $('#compareEmpty').hidden=candidates.length>0;$('#compareWorkspace').hidden=!candidates.length;
    if(!candidates.length){state.pair=[null,null];syncFacePair();renderFaces();releaseUnusedFullUrls();return;}
    if(!candidates.some(p=>p.id===state.pair[0]))state.pair[0]=candidates[0].id;
    if(!candidates.some(p=>p.id===state.pair[1]))state.pair[1]=candidates[1]?.id||null;
    if(!state.pair[state.active])state.active=0;
    syncFacePair();
    ['A','B'].forEach((slot,index)=>{
      const photo=byId(state.pair[index]);const select=$(`#select${slot}`);const previous=select.value;
      setOptions(select,candidates.map(item=>[item.id,item.name]),photo?.id||'');
      select.value=photo?.id||'';select.disabled=!photo;
      const img=$(`#image${slot}`);if(photo){const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#viewport'+slot).scrollTo(0,0);}img.alt=photo.name;renderComparisonImage(img,$('#viewport'+slot),photo,index);}else{img.removeAttribute('src');img.alt='';}
      $(`#dimensions${slot}`).textContent=photo?`${photo.width} × ${photo.height}`:'';renderPhotoQuality($(`#quality${slot}`),photo,true);
      const button=$(`#keep${slot}`);button.disabled=!photo;button.textContent=translate(photo?.kept?'kept':'keep');button.setAttribute('aria-pressed',String(!!photo?.kept));
      $(`#slot${slot}`).disabled=!photo;$(`#slot${slot}`).classList.toggle('active',state.active===index);$(`#slot${slot}`).setAttribute('aria-pressed',String(state.active===index));document.querySelector(`[data-slot="${index}"]`).classList.toggle('is-active',state.active===index);
    });
    $('#previousButton').disabled=candidates.length<2;$('#nextButton').disabled=candidates.length<2;
    renderFaces();releaseUnusedFullUrls();
  }
  // Face positions are temporary, pair-scoped display hints. They never enter photo,
  // grouping, quality, Keep or export records.
  function invalidateFaces(message='') {
    const job=state.faceJob;state.faceJob=null;
    if(job){clearTimeout(job.timer);job.controller.abort();job.client?.cancel();}
    state.faceResults.clear();state.faceSelected=[null,null];state.faceWhole=[false,false];
    state.faceMessage=message;
    ['A','B'].forEach(slot=>{delete $(`#viewport${slot}`).dataset.faceLayout;});
  }
  function syncFacePair() {
    if(state.facePair.some((id,index)=>id!==state.pair[index])){
      state.faceRevision++;invalidateFaces();state.facePair=[...state.pair];
    }
  }
  function assertFaceCurrent(job) {
    assertCurrent(job.generation,job.controller.signal);
    if(state.faceJob!==job||job.revision!==state.faceRevision||job.input!==state.inputRevision||job.pair.some((id,index)=>id!==state.pair[index])||job.photos.some(photo=>byId(photo.id)!==photo||photo.file!==job.files.get(photo.id)))throw new DOMException('Cancelled','AbortError');
  }
  function renderFaces() {
    const job=state.faceJob;
    $('#findFacesButton').disabled=!canRunOptionalModels()||!!state.load||!!state.analysis||!!job||!state.pair.some(id=>byId(id));
    $('#cancelFacesButton').hidden=!job;
    $('#faceStatus').textContent=job?`${translate(job.phase)} ${job.done} / ${job.photos.length}`:!canRunOptionalModels()?translate('optionalUnavailable'):state.faceMessage?translate(state.faceMessage):'';
    ['A','B'].forEach((slot,index)=>{
      const photo=byId(state.pair[index]),result=photo&&state.faceResults.get(photo.id);
      const controls=$(`#faceControls${slot}`),choices=$(`#faceChoices${slot}`);
      controls.hidden=!result;
      if(!result){choices.replaceChildren();delete choices.dataset.photoId;return;}
      // Retain focused buttons on Keep/language updates; numbering belongs to one photo.
      if(choices.dataset.photoId!==photo.id||choices.children.length!==result.faces.length){
        choices.dataset.photoId=photo.id;
        choices.replaceChildren(...result.faces.map((face,faceIndex)=>{
          const button=el('button','button quiet');button.type='button';button.dataset.faceIndex=String(faceIndex);
          button.addEventListener('click',()=>{
            if(state.pair[index]!==photo.id||state.faceResults.get(photo.id)!==result)return;
            state.faceSelected[index]=faceIndex;state.faceWhole[index]=false;state.active=index;
            delete $(`#viewport${slot}`).dataset.faceLayout;renderCompare();
          });return button;
        }));
      }
      [...choices.children].forEach((button,faceIndex)=>{
        button.textContent=`${translate('faceLabel')} ${faceIndex+1}`;
        button.setAttribute('aria-label',`${slot}: ${translate('faceLabel')} ${faceIndex+1}`);
        button.setAttribute('aria-pressed',String(state.faceSelected[index]===faceIndex));
      });
      const whole=$(`#wholeImage${slot}`);whole.setAttribute('aria-pressed',String(state.faceWhole[index]));
      whole.setAttribute('aria-label',`${slot}: ${translate('faceWhole')}`);
      $(`#faceMessage${slot}`).textContent=translate(result.faces.length?'faceChoose':'faceNone');
    });
  }
  function renderComparisonImage(img,viewport,photo,index) {
    const result=state.faceResults.get(photo.id),face=result?.faces[state.faceSelected[index]];
    if(face){scheduleFaceView(index);return;}
    delete viewport.dataset.faceLayout;viewport.classList.remove('face-zoom');img.style.margin='';
    zoomImage(img,viewport,photo,state.faceWhole[index]?'fit':$('#compareZoom').value);
  }
  function scheduleFaceView(index) {
    const slot=['A','B'][index],id=state.pair[index],photo=byId(id),result=state.faceResults.get(id);
    const selected=state.faceSelected[index],face=result?.faces[selected];if(!photo||!face)return;
    const generation=state.generation,revision=state.faceRevision,img=$(`#image${slot}`),viewport=$(`#viewport${slot}`),url=state.fullUrls.get(id);
    requestAnimationFrame(()=>{
      if(generation!==state.generation||revision!==state.faceRevision||state.pair[index]!==id||byId(id)!==photo||state.faceResults.get(id)!==result||state.faceSelected[index]!==selected||img.src!==url||!viewport.isConnected)return;
      const width=viewport.clientWidth,height=viewport.clientHeight;if(!width||!height)return;
      const key=`${revision}:${id}:${selected}:${width}:${height}`;if(viewport.dataset.faceLayout===key)return;
      const view=FaceGeometry.faceView(face,result.width,result.height,width,height);
      viewport.classList.add('zoomed','face-zoom');img.style.width=`${view.width}px`;img.style.height=`${view.height}px`;img.style.margin=`${view.insetY}px ${view.insetX}px`;
      viewport.scrollTo(view.left,view.top);viewport.dataset.faceLayout=key;
    });
  }
  async function facePixels(photo,job) {
    assertFaceCurrent(job);const image=new Image();let canvas;
    try{
      await new Promise((resolve,reject)=>{
        let settled=false;const timer=setTimeout(()=>finish(new Error('Face image decode timeout')),15000);
        const onAbort=()=>finish(new DOMException('Cancelled','AbortError'));
        function finish(error){if(settled)return;settled=true;clearTimeout(timer);job.controller.signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;error?reject(error):resolve();}
        job.controller.signal.addEventListener('abort',onAbort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Face image unavailable'));image.src=getFullUrl(photo);
      });
      assertFaceCurrent(job);
      // naturalWidth/Height and canvas drawImage share browser-applied EXIF orientation.
      // Never infer coordinates from encoded dimensions or rotate an already oriented image.
      const originalWidth=image.naturalWidth,originalHeight=image.naturalHeight;
      if(originalWidth!==photo.width||originalHeight!==photo.height||!originalWidth||!originalHeight)throw new Error('Oriented image dimensions changed');
      const scale=Math.min(1,FaceGeometry.CONFIG.sampleLongEdge/Math.max(originalWidth,originalHeight));
      const width=Math.max(1,Math.round(originalWidth*scale)),height=Math.max(1,Math.round(originalHeight*scale));
      canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('No face canvas');
      context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
      const rgba=context.getImageData(0,0,width,height).data,rgb=new Uint8Array(width*height*3);
      for(let p=0,q=0;p<rgba.length;p+=4){rgb[q++]=rgba[p];rgb[q++]=rgba[p+1];rgb[q++]=rgba[p+2];}
      assertFaceCurrent(job);return{rgb,width,height,originalWidth,originalHeight};
    }finally{image.removeAttribute('src');if(canvas)canvas.width=canvas.height=0;}
  }
  async function findFaces() {
    if(state.load||state.analysis||state.faceJob||$('#groupDialog').open||$('#similarityScopeDialog').open)return;
    if(!canRunOptionalModels()){renderFaces();return;}
    syncFacePair();const photos=[...new Set(state.pair)].map(byId).filter(Boolean);if(!photos.length)return;
    if(state.similarity)invalidateSimilarity('similarityCancelled',{preserveScope:true});
    invalidateFaces();
    const job={controller:new AbortController(),generation:state.generation,input:state.inputRevision,revision:state.faceRevision,pair:[...state.pair],photos,files:new Map(photos.map(photo=>[photo.id,photo.file])),client:null,phase:'faceLoading',done:0};
    state.faceJob=job;
    job.timer=setTimeout(()=>{if(state.faceJob===job){invalidateFaces('faceFailed');renderCompare();renderSimilarity();}},60000);
    renderCompare();renderSimilarity();
    try{
      const assets=window.StandaloneAssets;
      const [runtimeSource,detectorSource,workerSource,modelText,weights]=await Promise.all([
        assets.textAsync('tfjs','runtime'),assets.textAsync('face-detection','detector'),assets.textAsync('face-detection','worker'),assets.textAsync('face-detection','model'),assets.bytesAsync('face-detection','weights')]);
      assertFaceCurrent(job);
      job.client=new window.FaceWorkerClient({runtimeSource:runtimeSource+'\n'+detectorSource,workerSource,modelJson:JSON.parse(modelText),weightData:weights.slice().buffer});
      const abort=()=>job.client?.cancel();job.controller.signal.addEventListener('abort',abort,{once:true});
      try{
        await job.client.ready;assertFaceCurrent(job);job.phase='faceFinding';renderFaces();
        const results=new Map();
        for(const photo of photos){
          const pixels=await facePixels(photo,job);assertFaceCurrent(job);
          const result=await job.client.infer({rgb:pixels.rgb,width:pixels.width,height:pixels.height},{signal:job.controller.signal});assertFaceCurrent(job);
          const faces=FaceGeometry.normalizeFaces(result.faces,pixels.width,pixels.height);
          results.set(photo.id,{faces,width:pixels.originalWidth,height:pixels.originalHeight});job.done++;renderFaces();
          await new Promise(resolve=>setTimeout(resolve,0));assertFaceCurrent(job);
        }
        await job.client.close();assertFaceCurrent(job);
        state.faceResults=results;state.faceMessage=[...results.values()].some(result=>result.faces.length)?'faceReady':'faceNone';
      }finally{job.controller.signal.removeEventListener('abort',abort);}
    }catch(error){
      if(state.faceJob===job){state.faceResults.clear();state.faceMessage=error.name==='AbortError'?'faceCancelled':'faceFailed';}
    }finally{
      clearTimeout(job.timer);job.client?.dispose();
      if(state.faceJob===job){state.faceJob=null;renderCompare();renderSimilarity();}
    }
  }
  $('#findFacesButton').addEventListener('click',()=>void findFaces());
  $('#cancelFacesButton').addEventListener('click',()=>{invalidateFaces('faceCancelled');renderCompare();$('#findFacesButton').focus({preventScroll:true});});
  ['A','B'].forEach((slot,index)=>{
    $(`#wholeImage${slot}`).addEventListener('click',()=>{
      state.faceSelected[index]=null;state.faceWhole[index]=true;delete $(`#viewport${slot}`).dataset.faceLayout;
      renderCompare();$(`#viewport${slot}`).scrollTo(0,0);
    });
    $(`#image${slot}`).addEventListener('load',()=>scheduleFaceView(index));
  });
  if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(()=>{scheduleFaceView(0);scheduleFaceView(1);});
    ['A','B'].forEach(slot=>observer.observe($(`#viewport${slot}`)));
  }
  window.addEventListener('resize',()=>{scheduleFaceView(0);scheduleFaceView(1);});
  window.addEventListener('pagehide',()=>invalidateFaces());
  window.addEventListener('pageshow',event=>{if(event.persisted)renderCompare();});
  function renderSave() {
    const selected=kept();const duplicates=selected.map(p=>p.duplicateSetId).filter(Boolean);$('#duplicateWarning').hidden=new Set(duplicates).size===duplicates.length;$('#saveSummary').textContent=`${selected.length} ${translate('selected')} · ${sizeText(selected.reduce((sum,p)=>sum+p.size,0))}`;
    syncKeyedChildren($('#selectedList'),selected,photo=>photo.id,photo=>{const row=el('li'),image=el('img'),open=el('button'),remove=el('button','button remove-selection');image.src=photo.thumbnailUrl;image.alt='';image.loading='lazy';open.type='button';open.append(el('span','',photo.name));open.title=photo.name;open.addEventListener('click',event=>openPreview(photo.id,event.currentTarget,kept()));remove.type='button';remove.addEventListener('click',()=>selectPhoto(photo,'save'));row.append(image,open,remove);return row;},(row,photo)=>{const remove=row.querySelector('.remove-selection');setTextIfChanged(remove,translate('unkeep'));setAttributeIfChanged(remove,'aria-label',`${translate('unkeep')}: ${photo.name}`);});
    $('#saveEmpty').hidden=!!selected.length;$('#downloadButton').disabled=!selected.length||!!state.exporting||!!state.zipBatches||state.zipPlanning;$('#mobileSaveLabel').textContent=`${translate('save')}${selected.length?` (${selected.length})`:''}`;renderZipBatches();renderSelectionList();
  }
  function groupLabel(group){if(!group)return translate('allPhotos');const index=groupPositions.get(group.id)||state.groups.indexOf(group)+1;return `${translate(group.ids.length===1?'single':'group')} ${index} · ${group.ids.length} ${translate('loaded')} · ${group.ids.filter(id=>byId(id)?.kept).length} ${translate('selected')} · ${translate(group.manual?'manual':'automatic')}${group.reviewed?' · '+translate('reviewed'):''}`;}
  function comparisonPhotos(){const group=state.groups.find(g=>g.id===state.groupFilter);return group?group.ids.map(byId).filter(Boolean):ready();}
  function photoAnalysisLabel(photo){const status={pending:'pending','unique-size':'uniqueSize',checked:'checked',duplicate:'identical','skipped-large':'skippedLarge',unavailable:'unavailable',failed:'analysisFailedFile'}[photo.duplicateStatus]||'pending';const time=photo.captureTime;const text=time?`${translate(time.source==='exif-original'?'captureOriginal':'captureDigitized')}: ${time.display}${time.domain==='wall'?' ('+translate('unknownZone')+')':''}`:`${translate('modified')}: ${new Date(photo.timestamp).toLocaleString(language)}`;return `${translate(status)} · ${text}`;}
  function setOptions(select,entries,value){
    syncKeyedChildren(select,entries,entry=>entry[0],([id])=>{const option=el('option');option.value=id;return option;},(option,[id,text])=>setTextIfChanged(option,text));
    select.value=entries.some(([id])=>id===value)?value:(entries[0]?.[0]||'');
  }
  // Candidates are derived from current group membership, never stored in Undo patches or Keep state.
  function qualityResult(group){
    if(!group||group.ids.length<2)return{candidateId:null,status:'single',reasons:[]};
    const photos=group.ids.map(byId);
    if(photos.some(p=>!p?.qualityMetrics))return{candidateId:null,status:photos.some(p=>p?.qualityStatus==='failed')?'failed':'pending',reasons:[]};
    try{return Quality.recommend(photos.map(p=>({id:p.id,metrics:p.qualityMetrics})));}
    catch{return{candidateId:null,status:'uncertain',reasons:[]};}
  }
  function qualityReason(reason){return translate({'clearer-detail':'qualityDetail','less-highlight-clipping':'qualityHighlight'}[reason]||'qualityUncertain');}
  function qualityMessage(result){
    if(result.candidateId)return `${translate('qualityCandidate')}: ${byId(result.candidateId)?.name||''} · ${result.reasons.map(qualityReason).join(' · ')}`;
    return translate({single:'qualitySingle',pending:'qualityPending',failed:'qualityFailed',incomparable:'qualityIncomparable',uncertain:'qualityUncertain','near-tie':'qualityTie'}[result.status]||'qualityNone');
  }
  function renderPhotoQuality(node,photo,details=false){
    const group=photo?photoGroups.get(photo.id):null,result=state.qualityResults.get(group?.id);
    const signature=JSON.stringify([language,photo?.id,photo?.qualityStatus,details,details?photo?.qualityMetrics:null,result?.candidateId,result?.reasons]);
    if(qualityViews.get(node)===signature)return;qualityViews.set(node,signature);
    node.replaceChildren();node.classList.remove('is-candidate');node.hidden=!photo;if(!photo)return;
    if(result?.candidateId===photo.id){node.append(el('strong','quality-badge',translate('qualityCandidate')),el('span','',result.reasons.map(qualityReason).join(' · ')));node.classList.add('is-candidate');}
    else if(photo.qualityStatus==='failed')node.append(el('span','',translate('qualityFailed')));
    if(details&&photo.qualityMetrics){const m=photo.qualityMetrics;node.append(el('span','quality-measures',`${translate('qualityHighlights')}: ${(m.highlightRatio*100).toFixed(1)}% · ${translate('qualityDarks')}: ${(m.darkRatio*100).toFixed(1)}%`));}
    node.hidden=!node.childNodes.length;
  }
  function renderGroups(){
    photoGroups.clear();groupPositions.clear();state.groups.forEach((group,index)=>{groupPositions.set(group.id,index+1);group.ids.forEach(id=>photoGroups.set(id,group));});
    state.qualityResults=new Map(state.groups.map(g=>[g.id,qualityResult(g)]));$('#groupTools').hidden=!ready().length;if(!state.groups.some(g=>g.id===state.groupFilter))state.groupFilter='';
    setOptions($('#groupFilter'),[['',translate('allPhotos')],...state.groups.map(g=>[g.id,groupLabel(g)])],state.groupFilter);
    syncKeyedChildren($('#groupList'),state.groups,group=>group.id,group=>{const button=el('button','button group-chip');button.type='button';button.dataset.groupId=group.id;button.addEventListener('click',()=>{state.groupFilter=state.groupFilter===group.id?'':group.id;render();$('#groupFilter').focus({preventScroll:true});});return button;},(button,group)=>{setTextIfChanged(button,groupLabel(group));const active=state.groupFilter===group.id;if(button.classList.contains('active')!==active)button.classList.toggle('active',active);setAttributeIfChanged(button,'aria-pressed',active);});
    const active=state.groups.find(g=>g.id===state.groupFilter),candidateCount=[...state.qualityResults.values()].filter(r=>r.candidateId).length;$('#qualitySummary').textContent=active?qualityMessage(state.qualityResults.get(active.id)):candidateCount?`${candidateCount} ${translate(candidateCount===1?'qualityCountSingle':'qualityCount')}. ${translate('qualityNote')}`:translate('qualityNone');
    const duplicateSets=new Set(ready().map(p=>p.duplicateSetId).filter(Boolean));$('#groupSummary').textContent=`${state.groups.filter(g=>g.ids.length>1).length} ${translate('group')} · ${state.groups.filter(g=>g.ids.length===1).length} ${translate('single')} · ${duplicateSets.size} ${translate('identical')}`;
    $('#organizeButton').disabled=!state.groups.length||!!state.load;$('#analyzeButton').disabled=!!state.analysis||!!state.load;$('#regroupButton').disabled=!!state.analysis||!!state.load;$('#analysisResult').textContent=state.analysisMessage?translate(state.analysisMessage):'';
  }
  function stopAnalysis(){const job=state.analysis;if(job){job.controller.abort();state.analysis=null;}$('#analysisProgress').hidden=true;}
  async function analyzePhotos(reset=false){
    if(state.load||$('#groupDialog').open||!ready().length)return;invalidateFaces();invalidateSimilarity();stopAnalysis();const job={controller:new AbortController(),generation:state.generation,input:state.inputRevision,groups:state.groupingRevision};state.analysis=job;state.analysisMessage='';$('#analysisProgress').hidden=false;
    const current=()=>state.analysis===job&&job.generation===state.generation&&job.input===state.inputRevision&&job.groups===state.groupingRevision&&!job.controller.signal.aborted;
    const progress=(key,done,total)=>{if(!current())return;$('#analysisStatus').textContent=`${translate(key)} ${done} / ${total}`;$('#analysisMeter').max=Math.max(1,total);$('#analysisMeter').value=done;};
    renderGroups();renderSimilarity();renderCompare();try{
      const originals=ready().map(p=>({id:p.id,file:p.file,size:p.size}));
      const exact=await Core.findExactDuplicates(originals,{signal:job.controller.signal,onProgress:p=>progress(p.phase==='comparing'?'comparing':'hashing',p.completedFiles,p.totalFiles)});if(!current())return;
      const duplicateIds=new Map();exact.sets.forEach(ids=>ids.forEach(id=>duplicateIds.set(id,`duplicate-${ids[0]}`)));
      const records=ready().map(p=>({id:p.id,features:p.features,captureTime:p.captureTime,duplicateSetId:duplicateIds.get(p.id)||null}));
      const groups=await Groups.groupPhotos(records,{previousGroups:reset?[]:state.groups.filter(g=>!g.pending||g.manual),signal:job.controller.signal,onProgress:p=>progress('grouping',p.processed,p.total)});if(!current())return;
      const metrics=new Map();const qualityPhotos=ready();
      for(let index=0;index<qualityPhotos.length;index++){
        if(!current())return;progress('qualityMeasuring',index,qualityPhotos.length);
        try{metrics.set(qualityPhotos[index].id,await measurePhotoQuality(qualityPhotos[index],job.generation,job.controller.signal));}
        catch(error){if(error.name==='AbortError'||!current())return;metrics.set(qualityPhotos[index].id,null);}
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(!current())return;
      // Commit IDs/analysis only. File references and the user's Keep choices never come from a snapshot.
      for(const photo of ready()){photo.duplicateSetId=duplicateIds.get(photo.id)||null;photo.duplicateStatus=exact.statuses[photo.id]||'failed';photo.qualityMetrics=metrics.get(photo.id)||null;photo.qualityStatus=photo.qualityMetrics?'ready':'failed';}state.groups=groups;state.analysisMessage='analysisDone';
    }catch(error){if(current())state.analysisMessage=error.name==='AbortError'?'analysisCancelled':'analysisFailed';}
    finally{if(state.analysis===job){state.analysis=null;$('#analysisProgress').hidden=true;render();}}
  }
  function refreshGroupDialog(){
    const source=state.groups.find(g=>g.id===$('#sourceGroup').value)||state.groups[0];if(!source)return;
    setOptions($('#groupPhoto'),source.ids.map(id=>[id,byId(id)?.name||id]),$('#groupPhoto').value);
    setOptions($('#targetGroup'),state.groups.filter(g=>g.id!==source.id).map(g=>[g.id,groupLabel(g)]),$('#targetGroup').value);
    $('#splitGroupButton').disabled=source.ids.length<2;$('#moveGroupButton').disabled=state.groups.length<2;$('#mergeGroupButton').disabled=state.groups.length<2;$('#reviewGroupButton').textContent=translate('toggleReviewed')+' · '+translate(source.reviewed?'reviewed':'notReviewed');
  }
  function organizeGroups(){if(state.analysis){stopAnalysis();state.analysisMessage='analysisCancelled';renderGroups();renderSimilarity();}setOptions($('#sourceGroup'),state.groups.map(g=>[g.id,groupLabel(g)]),state.groupFilter||state.groups[0]?.id);refreshGroupDialog();$('#groupDialog').showModal();}
  function editGroup(type){
    invalidateSimilarity();stopAnalysis();const generation=state.generation;const result=Groups.editGroups(state.groups,{type,sourceId:$('#sourceGroup').value,targetId:$('#targetGroup').value,photoId:$('#groupPhoto').value});state.groupingRevision++;state.groups=result.groups;state.analysisMessage='';$('#groupDialog').close();$('#groupToastHost').append($('#appToast'));render();
    const restore=()=>$('#organizeButton').focus({preventScroll:true});showToast(translate('groupChanged'),{messageKey:'groupChanged',actionLabel:translate('undo'),duration:7000,onRestoreFocus:restore,onAction:()=>{if(state.generation!==generation)return;invalidateSimilarity();stopAnalysis();state.groupingRevision++;state.groups=Groups.undoEdit(state.groups,result.patch);render();restore();}});revealToast();
  }
  $('#groupFilter').addEventListener('change',event=>{state.groupFilter=event.target.value;render();});$('#organizeButton').addEventListener('click',organizeGroups);$('#sourceGroup').addEventListener('change',refreshGroupDialog);$('#closeGroupButton').addEventListener('click',()=>$('#groupDialog').close());
  for(const [id,type] of [['splitGroupButton','split'],['moveGroupButton','move'],['mergeGroupButton','merge'],['reviewGroupButton','review']])$('#'+id).addEventListener('click',()=>editGroup(type));
  $('#analyzeButton').addEventListener('click',()=>void analyzePhotos());$('#cancelAnalysisButton').addEventListener('click',()=>{stopAnalysis();state.analysisMessage='analysisCancelled';render();});
  $('#regroupButton').addEventListener('click',async()=>{if(await AppConfirm.ask({title:translate('regroupTitle'),message:translate('regroupMessage'),confirmLabel:translate('analyze'),cancelLabel:translate('cancel')})){state.groupingRevision++;void analyzePhotos(true);}});
  $('#groupDialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();});
  function invalidateSimilarity(message='similarityChanged',{preserveScope=false}={}){
    const hadWork=!!state.similarity||state.similarityProposals.length>0;
    const job=state.similarity;state.similarity=null;
    if(job){clearTimeout(job.timer);job.controller.abort();job.client?.dispose();}
    state.similarityProposals=[];
    if(!preserveScope)state.similarityScope=null;
    closeSimilarityScope();
    if(hadWork)state.similarityMessage=message;
  }
  function closeSimilarityScope(){
    const draft=state.similarityScopeDraft;state.similarityScopeDraft=null;
    const dialog=$('#similarityScopeDialog');if(dialog.open)dialog.close();
    if(draft){const opener=draft.opener?.isConnected&&!draft.opener.disabled?draft.opener:$('#chooseSimilarityGroupsButton');opener.focus({preventScroll:true});}
  }
  function openSimilarityScope(opener=$('#chooseSimilarityGroupsButton')){
    if(state.load||state.analysis||$('#groupDialog').open)return;
    const eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id));
    invalidateSimilarity('',{preserveScope:true});state.similarityMessage='';
    // Drafting a scope never starts the model or silently takes the first batch.
    state.similarityScopeDraft={groupIds:eligibility.photoCount<=Similarity.CONFIG.maxPhotos?[...eligibility.eligibleGroupIds]:[],generation:state.generation,input:state.inputRevision,groups:state.groupingRevision,opener};
    renderSimilarity();renderSimilarityScope();$('#similarityScopeDialog').showModal();$('#closeSimilarityScopeButton').focus({preventScroll:true});
  }
  function renderSimilarityScope(){
    const draft=state.similarityScopeDraft;if(!draft)return;
    const eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id)),eligibleIds=new Set(eligibility.eligibleGroupIds);
    $('#similarityScopeList').replaceChildren(...state.groups.filter(group=>eligibleIds.has(group.id)).map(group=>{
      const unavailable=group.ids.length>Similarity.CONFIG.maxPhotos,row=el('label','similarity-scope-option'+(unavailable?' is-unavailable':'')),checkbox=el('input');
      checkbox.type='checkbox';checkbox.dataset.groupId=group.id;checkbox.checked=draft.groupIds.includes(group.id);checkbox.disabled=unavailable;
      const image=el('img'),photo=byId(group.ids[0]);image.src=photo.thumbnailUrl;image.alt='';image.loading='lazy';
      const text=el('span','similarity-scope-text');text.append(el('strong','',`${translate(group.ids.length===1?'single':'group')} ${state.groups.indexOf(group)+1} · ${group.ids.length} ${translate('similarityScopePhotos')}`));
      const name=el('span','similarity-scope-name',photo.name);name.title=photo.name;text.append(name);
      if(unavailable)text.append(el('span','similarity-scope-reason',translate('similarityScopeTooLarge')));
      checkbox.addEventListener('change',()=>{if(state.similarityScopeDraft!==draft)return;draft.groupIds=checkbox.checked?[...draft.groupIds,group.id]:draft.groupIds.filter(id=>id!==group.id);renderSimilarityScopeCount();});
      row.append(checkbox,image,text);return row;
    }));
    $('#similarityScopeEmpty').hidden=eligibility.groupCount>0;renderSimilarityScopeCount();
  }
  function renderSimilarityScopeCount(){
    const draft=state.similarityScopeDraft;if(!draft)return;
    const eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id),draft.groupIds);
    $('#similarityScopeCount').textContent=`${eligibility.groupCount} ${translate('similarityScopeGroups')} · ${eligibility.photoCount} / ${Similarity.CONFIG.maxPhotos} ${translate('similarityScopePhotos')}`;
    $('#similarityScopeValidation').textContent=eligibility.reason==='photo-limit'?translate('similarityScopeOverLimit'):eligibility.groupCount<2?translate('similarityScopeNeedGroups'):'';
    $('#searchSimilarityScopeButton').disabled=!eligibility.ok;
  }
  function searchSimilarityScope(){
    const draft=state.similarityScopeDraft;if(!draft||state.load||state.analysis)return;
    if(draft.generation!==state.generation||draft.input!==state.inputRevision||draft.groups!==state.groupingRevision){invalidateSimilarity();renderSimilarity();return;}
    const eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id),state.similarityScopeDraft.groupIds);if(!eligibility.ok)return;
    state.similarityScope=[...eligibility.eligibleGroupIds];closeSimilarityScope();void findSimilarPhotos();
  }
  function renderSimilarity(){
    const allEligible=Similarity.eligibility(state.groups,ready().map(p=>p.id)),eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id),state.similarityScope??undefined);
    $('#similarityTools').hidden=!ready().length;
    $('#findSimilarButton').disabled=!canRunOptionalModels()||!!state.load||!!state.analysis||!!state.similarity||(!eligibility.ok&&eligibility.reason!=='photo-limit');
    $('#chooseSimilarityGroupsButton').disabled=!canRunOptionalModels()||!!state.load||!!state.analysis||!allEligible.groupCount;
    $('#similarityScopeSummary').hidden=!state.similarityScope;$('#similarityScopeSummary').textContent=state.similarityScope?`${translate('similarityScopeSelected')}: ${eligibility.groupCount} ${translate('similarityScopeGroups')} · ${eligibility.photoCount} ${translate('similarityScopePhotos')}`:'';
    $('#similarityLimit').textContent=translate(eligibility.reason==='photo-limit'?'similarityTooMany':eligibility.reason==='too-few-groups'?'similarityTooFew':'similarityLimit');
    $('#similarityProgress').hidden=!state.similarity;
    $('#similarityStatus').textContent=state.similarity?`${translate(state.similarity.phase)} ${state.similarity.done} / ${state.similarity.total}`:'';
    $('#similarityMeter').max=Math.max(1,state.similarity?.total||1);$('#similarityMeter').value=state.similarity?.done||0;
    $('#similarityMessage').textContent=!canRunOptionalModels()?translate('optionalUnavailable'):state.similarityMessage?translate(state.similarityMessage):'';
    $('#dismissSimilarityButton').hidden=!state.similarityProposals.length;
    $('#similarityResults').replaceChildren(...state.similarityProposals.map(proposal=>{
      const card=el('article','similarity-card'),title=el('h4','',`${proposal.photoIds.length} ${translate('loaded')} · ${proposal.groupIds.length} ${translate('group')}`),photos=el('div','similarity-photos');
      for(const id of proposal.photoIds){const photo=byId(id);if(!photo)continue;const button=el('button','similarity-photo');button.type='button';button.dataset.similarityPhotoId=id;button.title=photo.name;button.setAttribute('aria-label',`${translate('view')}: ${photo.name}`);const img=el('img');img.src=photo.thumbnailUrl;img.alt='';button.append(img,el('span','',photo.name));button.addEventListener('click',()=>openPreview(id,button,proposal.photoIds.map(byId).filter(Boolean)));photos.append(button);}
      const apply=el('button','button',translate('similarityApply'));apply.type='button';apply.addEventListener('click',()=>applySimilarityProposal(proposal));card.append(title,photos,apply);return card;
    }));
  }
  async function similarityPixels(photo,job){
    assertCurrent(job.generation,job.controller.signal);const image=new Image();let canvas;
    try{
      await new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>finish(new Error('Preview decode timeout')),10000),onAbort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){if(settled)return;settled=true;clearTimeout(timer);job.controller.signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;error?reject(error):resolve();}job.controller.signal.addEventListener('abort',onAbort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Preview unavailable'));image.src=photo.thumbnailUrl;});
      assertCurrent(job.generation,job.controller.signal);
      const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height||width>512||height>512)throw new Error('Invalid bounded preview');
      canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('No preview canvas');
      context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0);const rgba=context.getImageData(0,0,width,height).data,rgb=new Uint8Array(width*height*3);
      for(let p=0,q=0;p<rgba.length;p+=4){rgb[q++]=rgba[p];rgb[q++]=rgba[p+1];rgb[q++]=rgba[p+2];}return{rgb,width,height};
    }finally{image.removeAttribute('src');if(canvas)canvas.width=canvas.height=0;}
  }
  async function findSimilarPhotos(){
    if(state.load||state.analysis||state.similarity||$('#groupDialog').open||$('#similarityScopeDialog').open)return;
    if(!canRunOptionalModels()){renderSimilarity();return;}
    const eligibility=Similarity.eligibility(state.groups,ready().map(p=>p.id),state.similarityScope??undefined);
    if(eligibility.reason==='photo-limit'){openSimilarityScope($('#findSimilarButton'));return;}if(!eligibility.ok)return;
    invalidateFaces();renderCompare();invalidateSimilarity('',{preserveScope:true});state.similarityMessage='';
    const job={controller:new AbortController(),generation:state.generation,input:state.inputRevision,groups:state.groupingRevision,scopeGroupIds:[...eligibility.eligibleGroupIds],client:null,phase:'similarityLoading',done:0,total:eligibility.photoCount};state.similarity=job;
    const current=()=>state.similarity===job&&job.generation===state.generation&&job.input===state.inputRevision&&job.groups===state.groupingRevision&&!job.controller.signal.aborted;
    job.timer=setTimeout(()=>{if(current()){invalidateSimilarity('similarityFailed',{preserveScope:true});render();}},60000);renderSimilarity();
    try{
      const assets=window.StandaloneAssets;
      const [runtimeSource,workerSource,modelText,weights]=await Promise.all([assets.textAsync('tfjs','runtime'),assets.textAsync('embedding-worker','worker'),assets.textAsync('mobilenet-v1','model'),assets.bytesAsync('mobilenet-v1','weights')]);
      if(!current())return;
      job.client=new window.EmbeddingWorkerClient({runtimeSource,workerSource,modelJson:JSON.parse(modelText),weightData:weights.slice().buffer});
      const abort=()=>job.client?.cancel();job.controller.signal.addEventListener('abort',abort,{once:true});
      try{
        await job.client.ready;if(!current())return;job.phase='similarityFinding';renderSimilarity();const records=[];
        for(const id of eligibility.photoIds){
          if(!current())return;const photo=byId(id);if(!photo)throw new Error('Photo changed');
          const pixels=await similarityPixels(photo,job);if(!current())return;
          const result=await job.client.infer(pixels,{signal:job.controller.signal});if(!current())return;
          records.push({id,features:photo.features,embedding:Array.from(result.vector)});job.done++;renderSimilarity();await new Promise(resolve=>setTimeout(resolve,0));
        }
        await job.client.close();if(!current())return;
        const result=Similarity.propose(state.groups,records,{groupIds:job.scopeGroupIds});state.similarityProposals=result.proposals;state.similarityMessage=result.proposals.length?'similarityReady':'similarityNone';
      }finally{job.controller.signal.removeEventListener('abort',abort);}
    }catch(error){if(current())state.similarityMessage=error.name==='AbortError'?'similarityCancelled':'similarityFailed';}
    finally{clearTimeout(job.timer);job.client?.dispose();if(state.similarity===job){state.similarity=null;render();}}
  }
  function applySimilarityProposal(proposal){
    if(state.load||state.analysis||state.similarity)return;
    try{
      const result=Similarity.apply(state.groups,proposal),generation=state.generation;
      invalidateSimilarity('similarityApplied');state.groupingRevision++;state.groups=result.groups;render();
      $('#groupToastHost').append($('#appToast'));$('#organizeButton').focus({preventScroll:true});
      showToast(translate('groupChanged'),{messageKey:'groupChanged',actionLabel:translate('undo'),duration:7000,onRestoreFocus:()=>$('#organizeButton').focus({preventScroll:true}),onAction:()=>{if(state.generation!==generation)return;stopAnalysis();invalidateSimilarity();state.groupingRevision++;state.groups=Groups.undoEdit(state.groups,result.patch);render();$('#organizeButton').focus({preventScroll:true});}});revealToast();
    }catch{invalidateSimilarity('similarityChanged');render();}
  }
  $('#chooseSimilarityGroupsButton').addEventListener('click',event=>openSimilarityScope(event.currentTarget));
  $('#closeSimilarityScopeButton').addEventListener('click',()=>closeSimilarityScope());
  $('#cancelSimilarityScopeButton').addEventListener('click',()=>closeSimilarityScope());
  $('#searchSimilarityScopeButton').addEventListener('click',searchSimilarityScope);
  $('#similarityScopeDialog').addEventListener('cancel',event=>{event.preventDefault();closeSimilarityScope();});
  $('#similarityScopeDialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSimilarityScope();});
  $('#findSimilarButton').addEventListener('click',()=>void findSimilarPhotos());
  $('#cancelSimilarityButton').addEventListener('click',()=>{invalidateSimilarity('similarityCancelled',{preserveScope:true});render();$('#findSimilarButton').focus({preventScroll:true});});
  $('#dismissSimilarityButton').addEventListener('click',()=>{invalidateSimilarity('',{preserveScope:true});state.similarityMessage='';render();$('#findSimilarButton').focus({preventScroll:true});});
  window.addEventListener('pagehide',()=>invalidateSimilarity(''));
  window.addEventListener('pageshow',event=>{if(event.persisted)renderSimilarity();});
  function renderModelLicenses() {
    const {phase,text}=state.modelLicenses;
    $('#modelLicenseText').textContent=phase==='loaded'?text:'';
    $('#modelLicenseStatus').textContent=phase==='loading'?translate('licenseLoading'):phase==='failed'?translate('licenseFailed'):'';
    $('#modelLicenseStatus').hidden=phase==='idle'||phase==='loaded';
    $('#retryModelLicensesButton').hidden=phase!=='failed';
    $('#modelLicenses').setAttribute('aria-busy',String(phase==='loading'));
  }
  async function loadModelLicenses() {
    const licenses=state.modelLicenses;if(licenses.phase==='loaded'||licenses.phase==='loading')return;
    licenses.phase='loading';licenses.text='';renderModelLicenses();
    try{
      const texts=await Promise.all(['mobilenet-v1','face-detection'].flatMap(id=>['notices','license'].map(key=>window.StandaloneAssets.textAsync(id,key))));
      licenses.text=texts.join('\n\n');licenses.phase='loaded';
    }catch{licenses.phase='failed';}
    renderModelLicenses();
  }
  $('#modelLicenses').addEventListener('toggle',()=>{if($('#modelLicenses').open)void loadModelLicenses();});
  $('#retryModelLicensesButton').addEventListener('click',()=>{$('#modelLicenses summary').focus({preventScroll:true});void loadModelLicenses();});

  function failureText(code) { return translate(({UNSUPPORTED_IMAGE:'unsupported',INVALID_IMAGE:'invalid',ANIMATED_IMAGE:'animated',IMAGE_TOO_LARGE:'largeImage',EMPTY:'emptyFile',CANCELLED:'loadCancelled'})[code]||'invalid'); }
  function renderErrors() { $('#errorsPanel').hidden=!state.failures.length;$('#errorsSummary').textContent=`${state.failures.length} ${translate('failed')}`;$('#errorList').replaceChildren(...state.failures.map(item=>el('li','',`${item.file.name}: ${failureText(item.code)}`)));$('#retryButton').disabled=!!state.load; }
  function render() { $('#sessionSummary').textContent=summary();$('#clearButton').disabled=!ready().length&&!state.failures.length&&!state.load;$('#emptyHint').hidden=!!ready().length;$('#dropZone').classList.toggle('compact',!!ready().length);renderGroups();renderSimilarity();renderGrid();renderCompare();renderSave();renderErrors();renderPreview();mobile.setEnabled('compare',!!ready().length);if(state.load)updateLoadProgress(); }
  function assertCurrent(generation,signal){if(generation!==state.generation||signal.aborted)throw new DOMException('Cancelled','AbortError');}
  async function measurePhotoQuality(photo,generation,signal){
    // Reuse the oriented thumbnail: one small decode and one bounded pixel buffer at a time.
    assertCurrent(generation,signal);const image=new Image();let canvas=null;
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Preview decode timeout')),10000);const onAbort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){clearTimeout(timer);signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;error?reject(error):resolve();}signal.addEventListener('abort',onAbort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Preview decode failed'));image.src=photo.thumbnailUrl;});
      assertCurrent(generation,signal);const scale=Math.min(1,Quality.CONFIG.sampleLongEdge/Math.max(image.naturalWidth,image.naturalHeight));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('No quality canvas');context.drawImage(image,0,0,canvas.width,canvas.height);const metrics=await Quality.measure(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);assertCurrent(generation,signal);return metrics;
    }finally{image.src='';if(canvas)canvas.width=canvas.height=1;}
  }
  async function decodePhoto(file,generation,signal) {
    if(!file.size)throw Object.assign(new Error('Empty'),{code:'EMPTY'});
    const header=Core.inspectImageHeader(new Uint8Array(await file.slice(0,512*1024).arrayBuffer()));assertCurrent(generation,signal);
    let url=URL.createObjectURL(file);const image=new Image();let thumbnailUrl=null;
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Decode timeout')),30000);const onAbort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){clearTimeout(timer);signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;error?reject(error):resolve();}signal.addEventListener('abort',onAbort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Decode failed'));image.src=url;});
      assertCurrent(generation,signal);const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height)throw new Error('No dimensions');if(width*height>100000000||width>32768||height>32768)throw Object.assign(new Error('Image too large'),{code:'IMAGE_TOO_LARGE'});
      const scale=Math.min(1,480/Math.max(width,height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('No canvas');context.drawImage(image,0,0,canvas.width,canvas.height);
      let features=null;try{const sample=document.createElement('canvas');sample.width=9;sample.height=8;const c=sample.getContext('2d',{willReadFrequently:true});c.fillStyle='#fff';c.fillRect(0,0,9,8);c.drawImage(image,0,0,9,8);features=Groups.features(c.getImageData(0,0,9,8).data,9,8,width/height);sample.width=sample.height=1;}catch{/* Analysis failure must not reject a valid photo. */}
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Thumbnail failed')),'image/png'));canvas.width=canvas.height=1;assertCurrent(generation,signal);thumbnailUrl=URL.createObjectURL(blob);
      return {id:`p${state.nextId++}`,file,name:file.name,size:file.size,mime:header.format,width,height,orientation:header.orientation,thumbnailUrl,kept:false,qualityMetrics:null,qualityStatus:'pending',features,captureTime:header.captureTime||null,duplicateSetId:null,duplicateStatus:'pending',timestamp:file.lastModified,timestampSource:'file-last-modified'};
    }catch(error){if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);throw error;}finally{image.src='';URL.revokeObjectURL(url);}
  }
  function updateLoadProgress(){const job=state.load;if(!job)return;$('#loadStatus').textContent=`${translate('loading')} ${job.done} / ${job.total}`;$('#loadMeter').max=Math.max(1,job.total);$('#loadMeter').value=job.done;}
  async function runQueue() {
    if(state.load||!state.queue.length)return;
    const job={controller:new AbortController(),generation:state.generation,done:0,total:state.queue.length};state.load=job;$('#loadProgress').hidden=false;render();
    try{
      while(state.queue.length){assertCurrent(job.generation,job.controller.signal);const file=state.queue.shift();try{const photo=await decodePhoto(file,job.generation,job.controller.signal);assertCurrent(job.generation,job.controller.signal);state.photos.push(photo);photoIndex.set(photo.id,photo);state.groups.push({id:`g-${photo.id}`,ids:[photo.id],manual:false,reviewed:false,pending:true});}catch(error){if(job.generation!==state.generation)break;state.failures.push({file,code:error.name==='AbortError'?'CANCELLED':error.code||'INVALID_IMAGE'});if(error.name==='AbortError')break;}job.done++;render();await new Promise(resolve=>setTimeout(resolve,0));}
    }catch(error){if(error.name!=='AbortError')showToast(translate('invalid'));}
    finally{
      if(job.generation===state.generation){if(job.controller.signal.aborted){state.failures.push(...state.queue.splice(0).map(file=>({file,code:'CANCELLED'})));$('#loadStatus').textContent=translate('cancelled');}else $('#loadStatus').textContent=translate('readFinished');}
      if(state.load===job){state.load=null;$('#loadProgress').hidden=true;render();if(state.photos.length)void analyzePhotos();}
    }
  }
  function addFiles(files){const list=Array.from(files);if(!list.length)return;invalidateFaces();invalidateSimilarity();state.inputRevision++;stopAnalysis();state.queue.push(...list);if(state.load){state.load.total+=list.length;updateLoadProgress();}else void runQueue();}
  function activePhoto(){return byId(state.pair[state.active]);}
  function movePhoto(delta,preview=false){const candidates=preview?state.previewIds.map(byId).filter(Boolean):comparisonPhotos();const id=preview?state.previewId:state.pair[state.active];const index=candidates.findIndex(p=>p.id===id);if(!candidates.length)return;const next=candidates[(index+delta+candidates.length)%candidates.length];if(preview){state.previewId=next.id;$('#previewZoom').value='fit';renderPreview();releaseUnusedFullUrls();}else{state.pair[state.active]=next.id;renderCompare();}}
  let previewReturnHost = $('#toastHost'),previewSimilarityReturn=null,previewOpener=null,previewFromSave=false;
  function openPreview(id,opener,candidates){previewOpener=opener;previewFromSave=!!opener.closest('#savePage');previewSimilarityReturn=opener.dataset.similarityPhotoId||null;previewReturnHost=(previewSimilarityReturn?$('#groupToastHost'):null)||opener.closest('.photo-card')?.querySelector('.photo-info') || (opener.closest('#savePage') ? $('#saveToastHost') : document.querySelector(`[data-slot="${state.active}"]`)) || $('#toastHost');if(!byId(id))return;state.previewIds=candidates.map(p=>p.id);if(!state.previewIds.includes(id))state.previewIds=[id,...state.previewIds];state.previewId=id;$('#previewZoom').value='fit';renderPreview();if(!$('#previewDialog').open)$('#previewDialog').showModal();$('#previewToastHost').append($('#appToast'));}
  function renderPreview(){const photo=byId(state.previewId);if(!photo)return;$('#previewName').textContent=photo.name;renderPhotoQuality($('#qualityPreview'),photo,true);const img=$('#previewImage');const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#previewViewport').scrollTo(0,0);}img.alt=photo.name;zoomImage(img,$('#previewViewport'),photo,$('#previewZoom').value);$('#previewKeep').textContent=translate(photo.kept?'kept':'keep');$('#previewKeep').setAttribute('aria-pressed',String(photo.kept));$('#previewPrevious').disabled=state.previewIds.filter(byId).length<2;$('#previewNext').disabled=state.previewIds.filter(byId).length<2;}
  function setExportMessage(key){$('#exportResult').dataset.messageKey=key;$('#exportResult').textContent=key?translate(key):'';}
  async function exportZip(){if(state.exporting||state.zipBatches||state.zipPlanning||!kept().length)return;const files=kept().map(photo=>photo.file);const job={controller:new AbortController(),generation:state.generation};state.exporting=job;const name=Core.zipFilename(outputFilename.value,defaultZipName()+'.zip');outputFilename.value=name.replace(/\.zip$/i,'');setExportMessage('');$('#exportProgress').hidden=false;$('#exportMeter').value=0;renderSave();
    try{const blob=await Core.createZip(files,{signal:job.controller.signal,onProgress:progress=>{if(state.exporting!==job||job.generation!==state.generation)return;$('#exportMeter').max=Math.max(1,progress.totalBytes);$('#exportMeter').value=progress.processedBytes;$('#exportStatus').textContent=`${translate('exporting')} ${progress.completedFiles} / ${progress.totalFiles}`;}});assertCurrent(job.generation,job.controller.signal);const url=URL.createObjectURL(blob);state.downloadUrls.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();state.ordinaryDownloadPending=true;setTimeout(()=>{URL.revokeObjectURL(url);state.downloadUrls.delete(url);},60000);setExportMessage('exportDone');}
    catch(error){if(job.generation===state.generation)setExportMessage(error.name==='AbortError'?'exportCancelled':error.code==='ZIP_LIMIT'?'zipLimit':'exportFailed');}
    finally{if(state.exporting===job){state.exporting=null;$('#exportProgress').hidden=true;renderSave();}}
  }
  function canDownloadSelectionList(){
    const batch=state.zipBatches;
    if(state.load||state.zipPlanning||state.selectionListDownloading||batch?.closing)return false;
    if(state.exporting&&state.exporting.batch!==batch)return false;
    if(batch)return true;
    return $('#zipMode').value==='single'&&kept().length>0;
  }
  function renderSelectionList(){
    const batch=state.zipBatches,enabled=canDownloadSelectionList();
    const key=batch?'selectionListBatch':$('#zipMode').value==='batches'?'selectionListNeedPlan':'selectionListCurrent';
    $('#selectionListSummary').textContent=translate(key);
    $('#downloadSelectionJsonButton').disabled=!enabled;$('#downloadSelectionCsvButton').disabled=!enabled;
    $('#selectionListResult').textContent=state.selectionListStatus?translate(state.selectionListStatus):'';
  }
  function downloadSelectionList(format){
    if(!canDownloadSelectionList()||!['json','csv'].includes(format))return;
    state.selectionListDownloading=true;state.selectionListStatus='';renderSelectionList();
    let url=null;
    try{
      // Capture only metadata from the exact planned selection. No image-byte reads.
      const batch=state.zipBatches,plan=batch?batch.plan:Core.planZipBatches(kept().map(photo=>photo.file),{maxBytes:0xfffffffe});
      const list=Core.createSelectionList(plan,batch?batch.name:Core.zipFilename(outputFilename.value,defaultZipName()+'.zip'),batch?'zip_batch_plan':'current_keep');
      const text=Core.serializeSelectionList(list,format),name=Core.selectionListFilename($('#selectionListName').value||defaultZipName(),format);
      const blob=new Blob([text],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});
      url=URL.createObjectURL(blob);state.selectionListUrls.add(url);
      const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();
      const requestedUrl=url;setTimeout(()=>{URL.revokeObjectURL(requestedUrl);state.selectionListUrls.delete(requestedUrl);},60000);
      state.selectionListStatus='selectionListDone';
    }catch(error){
      if(url){URL.revokeObjectURL(url);state.selectionListUrls.delete(url);}
      state.selectionListStatus=error.code==='ZIP_LIMIT'?'selectionListLimit':'selectionListFailed';
    }finally{
      renderSelectionList();setTimeout(()=>{state.selectionListDownloading=false;renderSelectionList();},500);
    }
  }
  $('#downloadSelectionJsonButton').addEventListener('click',()=>downloadSelectionList('json'));
  $('#downloadSelectionCsvButton').addEventListener('click',()=>downloadSelectionList('csv'));
  function renderZipBatches() {
    const batch=state.zipBatches,mode=$('#zipMode').value==='batches';
    $('#zipMode').disabled=!!batch||!!state.exporting||state.zipPlanning;
    $('#zipBatchOptions').hidden=!mode;$('#downloadButton').hidden=mode;
    $('#zipBatchSize').disabled=!!batch||!!state.exporting||state.zipPlanning;
    outputFilename.disabled=!!batch||!!state.exporting||state.zipPlanning;
    $('#planZipBatchesButton').hidden=!!batch;
    $('#planZipBatchesButton').disabled=!kept().length||!$('#zipBatchSize').value||!!state.exporting||state.zipPlanning;
    $('#zipBatchPanel').hidden=!batch;
    const error=state.zipPlanError;
    $('#zipBatchError').textContent=error?error.code==='ZIP_FILE_TOO_LARGE'?`${translate('zipTooLarge')} ${error.name} (${error.requiredBytes} ${translate('zipBytes')}). ${translate('zipTooLargeHelp')}`:translate('zipPlanInvalid'):'';
    if(!batch)return;
    const part=batch.plan.batches[batch.index];
    $('#zipBatchSummary').textContent=`${translate('zipPlanLabel')}: ${batch.plan.totalFiles} ${translate('zipFiles')} · ${batch.plan.batches.length} ${translate('zipArchives')} · ${batch.plan.estimatedBytes.toLocaleString(language)} ${translate('zipBytes')}`;
    $('#zipBatchCurrent').textContent=`${translate('zipPart')} ${batch.index+1} / ${batch.plan.batches.length}: ${Core.zipBatchFilename(batch.name,batch.index,batch.plan.batches.length)} · ${part.totalFiles} ${translate('zipFiles')} · ${part.estimatedBytes.toLocaleString(language)} ${translate('zipBytes')}`;
    $('#zipBatchStatus').textContent=translate(({planned:'zipPrepare',building:'exporting',ready:'zipReady',requested:'zipRequested',cancelled:'zipCancelled',failed:'zipFailed'})[batch.phase]);
    $('#prepareZipBatchButton').hidden=!['planned','cancelled','failed'].includes(batch.phase);
    $('#prepareZipBatchButton').disabled=batch.closing;
    $('#downloadZipBatchButton').hidden=batch.phase!=='ready';
    $('#retryZipBatchDownloadButton').hidden=batch.phase!=='requested';
    $('#zipBatchDuplicateNote').hidden=batch.phase!=='requested';
    $('#nextZipBatchButton').hidden=batch.phase!=='requested'||batch.index===batch.plan.batches.length-1;
    $('#finishZipBatchesButton').hidden=batch.phase!=='requested'||batch.index!==batch.plan.batches.length-1;
    $('#closeZipBatchesButton').disabled=batch.closing;
    const list=$('#zipBatchList');
    if(list.dataset.plan!==batch.token+language){
      list.replaceChildren(...batch.plan.batches.map((part,index)=>{
        const item=el('li'),detail=el('details'),summary=el('summary');
        summary.textContent=`${Core.zipBatchFilename(batch.name,index,batch.plan.batches.length)} · ${part.totalFiles} ${translate('zipFiles')} · ${part.estimatedBytes.toLocaleString(language)} ${translate('zipBytes')}`;
        const names=el('ul');part.names.forEach(name=>names.append(el('li','',name)));detail.append(summary,names);item.append(detail);return item;
      }));list.dataset.plan=batch.token+language;
    }
  }
  function releaseZipBatch(batch){
    if(batch.url){URL.revokeObjectURL(batch.url);state.downloadUrls.delete(batch.url);batch.url=null;}
    batch.blob=null;
  }
  function disposeZipBatches(){
    const batch=state.zipBatches;if(!batch)return;
    batch.controller?.abort();releaseZipBatch(batch);state.zipBatches=null;
    if(state.exporting?.batch===batch){state.exporting=null;$('#exportProgress').hidden=true;}
  }
  async function planZipBatches(){
    if(state.zipBatches||state.exporting||state.zipPlanning||!kept().length)return;
    const capacity=Number($('#zipBatchSize').value)*1048576;
    if(![32,64,128,256,512].includes(capacity/1048576)){state.zipPlanError={code:'INVALID'};renderSave();return;}
    const generation=state.generation;
    state.zipPlanning=true;renderSave();
    try{
      if(state.downloadUrls.size||state.ordinaryDownloadPending){
        const confirmed=await AppConfirm.ask({title:translate('zipCloseTitle'),message:translate('zipPreviousDownload'),confirmLabel:translate('confirmAction'),cancelLabel:translate('cancel')});
        if(!confirmed||generation!==state.generation)return;
        state.downloadUrls.forEach(url=>URL.revokeObjectURL(url));state.downloadUrls.clear();state.ordinaryDownloadPending=false;
      }
      if(generation!==state.generation)return;
      const files=kept().map(photo=>photo.file),plan=Core.planZipBatches(files,{maxBytes:capacity});
      state.zipBatches={plan,index:0,phase:'planned',name:Core.zipFilename(outputFilename.value,defaultZipName()+'.zip'),generation,token:String(++zipPlanSequence),blob:null,url:null,controller:null,closing:false};
      state.zipPlanError=null;setExportMessage('');$('#zipBatchList').dataset.plan='';
    }catch(error){state.zipPlanError={code:error.code,name:error.fileName||error.originalName||kept()[error.fileIndex]?.name||'',requiredBytes:error.requiredBytes};}
    finally{state.zipPlanning=false;renderSave();if(state.zipBatches)$('#prepareZipBatchButton').focus({preventScroll:true});}
  }
  let zipPlanSequence=0;
  async function prepareZipBatch(){
    const batch=state.zipBatches;
    if(!batch||batch.closing||state.exporting||!['planned','failed','cancelled'].includes(batch.phase))return;
    releaseZipBatch(batch);const controller=new AbortController(),job={controller,generation:batch.generation,batch};batch.controller=controller;batch.phase='building';state.exporting=job;
    $('#exportProgress').hidden=false;$('#exportMeter').value=0;renderSave();$('#cancelExportButton').focus({preventScroll:true});
    try{
      const blob=await Core.createZipBatch(batch.plan,batch.index,{signal:controller.signal,onProgress:progress=>{
        if(state.zipBatches!==batch||state.exporting!==job||batch.generation!==state.generation)return;
        $('#exportMeter').max=Math.max(1,progress.totalBytes);$('#exportMeter').value=progress.processedBytes;$('#exportStatus').textContent=`${translate('exporting')} ${progress.completedFiles} / ${progress.totalFiles}`;
      }});
      assertCurrent(batch.generation,controller.signal);if(state.zipBatches!==batch||state.exporting!==job)return;
      batch.blob=blob;batch.url=URL.createObjectURL(blob);state.downloadUrls.add(batch.url);batch.phase='ready';
    }catch(error){if(state.zipBatches===batch&&batch.generation===state.generation)batch.phase=error.name==='AbortError'?'cancelled':'failed';}
    finally{const restoreFocus=document.activeElement===$('#cancelExportButton');if(state.exporting===job){state.exporting=null;$('#exportProgress').hidden=true;}if(state.zipBatches===batch){batch.controller=null;renderSave();if(restoreFocus)$(batch.phase==='ready'?'#downloadZipBatchButton':'#prepareZipBatchButton').focus({preventScroll:true});}}
  }
  function downloadZipBatch(repeat=false){
    const batch=state.zipBatches;if(!batch||batch.closing||!batch.url||batch.phase!==(repeat?'requested':'ready'))return;
    if(repeat&&batch.redownloadPending)return;
    batch.phase='requested';batch.redownloadPending=true;renderSave();
    const anchor=document.createElement('a');anchor.href=batch.url;anchor.download=Core.zipBatchFilename(batch.name,batch.index,batch.plan.batches.length);document.body.append(anchor);anchor.click();anchor.remove();
    $('#retryZipBatchDownloadButton').disabled=true;
    setTimeout(()=>{batch.redownloadPending=false;if(state.zipBatches===batch)$('#retryZipBatchDownloadButton').disabled=false;},500);
    $(batch.index===batch.plan.batches.length-1?'#finishZipBatchesButton':'#nextZipBatchButton').focus({preventScroll:true});
  }
  function advanceZipBatch(){
    const batch=state.zipBatches;if(!batch||batch.closing||batch.phase!=='requested')return;
    releaseZipBatch(batch);
    if(batch.index===batch.plan.batches.length-1){state.zipBatches=null;setExportMessage('zipConfirmed');renderSave();$('#planZipBatchesButton').focus({preventScroll:true});return;}
    batch.index++;batch.phase='planned';renderSave();$('#prepareZipBatchButton').focus({preventScroll:true});
  }
  async function closeZipBatches(){
    const batch=state.zipBatches;if(!batch||batch.closing)return;batch.closing=true;renderSave();
    const confirmed=!batch.url||await AppConfirm.ask({title:translate('zipCloseTitle'),message:translate('zipCloseMessage'),confirmLabel:translate('zipClose'),cancelLabel:translate('cancel')});
    if(state.zipBatches!==batch)return;
    batch.closing=false;if(confirmed){disposeZipBatches();setExportMessage('exportCancelled');}
    renderSave();$(confirmed?'#planZipBatchesButton':'#closeZipBatchesButton').focus({preventScroll:true});
  }
  $('#zipMode').addEventListener('change',()=>{state.zipPlanError=null;renderSave();});
  $('#zipBatchSize').addEventListener('change',()=>{state.zipPlanError=null;renderSave();});
  $('#planZipBatchesButton').addEventListener('click',()=>void planZipBatches());
  $('#prepareZipBatchButton').addEventListener('click',()=>void prepareZipBatch());
  $('#downloadZipBatchButton').addEventListener('click',()=>downloadZipBatch());
  $('#retryZipBatchDownloadButton').addEventListener('click',()=>downloadZipBatch(true));
  $('#nextZipBatchButton').addEventListener('click',advanceZipBatch);$('#finishZipBatchesButton').addEventListener('click',advanceZipBatch);
  $('#closeZipBatchesButton').addEventListener('click',()=>void closeZipBatches());
  function resetSession(){ state.selectionListStatus='';disposeZipBatches();state.zipPlanError=null; invalidateFaces();invalidateSimilarity('');state.similarityMessage='';$('#toastHost').append($('#appToast'));stopAnalysis();state.qualityResults.clear();state.groups=[];state.groupFilter='';state.analysisMessage='';state.inputRevision++;state.groupingRevision++;if($('#groupDialog').open)$('#groupDialog').close();state.generation++;state.load?.controller.abort();state.exporting?.controller.abort();state.load=null;state.exporting=null;state.queue=[];state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.photos=[];photoIndex.clear();photoGroups.clear();groupPositions.clear();cardViews.clear();keyedRows=new WeakMap();qualityViews=new WeakMap();state.failures=[];state.pair=[null,null];state.previewId=null;state.previewIds=[];state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.fullUrls.clear();$('#photoGrid').replaceChildren();$('#selectA').replaceChildren();$('#selectB').replaceChildren();['#imageA','#imageB','#previewImage'].forEach(selector=>$(selector).removeAttribute('src'));$('#loadProgress').hidden=true;$('#exportProgress').hidden=true;setExportMessage('');if($('#previewDialog').open)$('#previewDialog').close();AppToast.dismiss();mobile.showPage('photos');render();}
  $('#addButton').addEventListener('click',()=>$('#fileInput').click());$('#fileInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});$('#folderButton').hidden=!('webkitdirectory' in document.createElement('input'));$('#folderButton').addEventListener('click',()=>$('#folderInput').click());$('#folderInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});
  const drop=$('#dropZone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag-over');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,()=>drop.classList.remove('drag-over')));drop.addEventListener('drop',event=>{event.preventDefault();addFiles(event.dataTransfer.files);});window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>event.preventDefault());
  $('#cancelLoadButton').addEventListener('click',()=>state.load?.controller.abort());$('#retryButton').addEventListener('click',()=>{const files=state.failures.map(item=>item.file);state.failures=[];addFiles(files);});$('#cancelExportButton').addEventListener('click',()=>state.exporting?.controller.abort());$('#downloadButton').addEventListener('click',exportZip);
  $('#clearButton').addEventListener('click',async()=>{if(await AppConfirm.ask({title:translate('clearTitle'),message:translate('clearMessage')+(state.zipBatches?.url?' '+translate('zipCloseMessage'):''),confirmLabel:translate('clearAction'),cancelLabel:translate('cancel'),tone:'danger'}))resetSession();});
  ['A','B'].forEach((slot,index)=>{$(`#slot${slot}`).addEventListener('click',()=>{state.active=index;renderCompare();});$(`#select${slot}`).addEventListener('change',event=>{state.active=index;state.pair[index]=event.target.value;renderCompare();});$(`#keep${slot}`).addEventListener('click',()=>{state.active=index;selectPhoto(byId(state.pair[index]));});});$('#compareZoom').addEventListener('change',()=>{state.faceSelected=[null,null];state.faceWhole=[false,false];renderCompare();});$('#previousButton').addEventListener('click',()=>movePhoto(-1));$('#nextButton').addEventListener('click',()=>movePhoto(1));$('#openPreviewButton').addEventListener('click',event=>openPreview(state.pair[state.active],event.currentTarget,comparisonPhotos()));$('#previewPrevious').addEventListener('click',()=>movePhoto(-1,true));$('#previewNext').addEventListener('click',()=>movePhoto(1,true));$('#previewKeep').addEventListener('click',()=>selectPhoto(byId(state.previewId)));$('#previewZoom').addEventListener('change',renderPreview);
  $('#languageButton').addEventListener('click',()=>{language=language==='ja'?'en':'ja';writeStorage(storageKeys.language,language);applyLanguage();});$('#helpButton').addEventListener('click',()=>$('#helpDialog').showModal());$('#closeHelpButton').addEventListener('click',()=>$('#helpDialog').close());$('#closePreviewButton').addEventListener('click',()=>$('#previewDialog').close());
  [$('#helpDialog'),$('#previewDialog')].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));$('#previewDialog').addEventListener('close',()=>{const hadPreview=!!state.previewId;state.previewId=null;$('#previewImage').removeAttribute('src');const toast=$('#appToast');(previewReturnHost.isConnected ? previewReturnHost : $('#toastHost')).append(toast);if(hadPreview&&toast.classList.contains('show'))revealToast();releaseUnusedFullUrls();if(previewSimilarityReturn){const button=[...document.querySelectorAll('.similarity-photo')].find(n=>n.dataset.similarityPhotoId===previewSimilarityReturn);(button||(!$('#findSimilarButton').disabled?$('#findSimilarButton'):$('#addButton'))).focus({preventScroll:true});previewSimilarityReturn=null;}else if(hadPreview&&previewFromSave&&!previewOpener?.isConnected){const target=$('#selectedList button')||(!outputFilename.disabled?outputFilename:$('#selectionListOptions > summary'));target.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});target.focus({preventScroll:true});}previewOpener=null;previewFromSave=false;});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;if($('#helpDialog').open||$('#appConfirmDialog').open||$('#groupDialog').open||$('#similarityScopeDialog').open)return;const preview=$('#previewDialog').open;if(!preview&&window.matchMedia('(max-width:600px)').matches&&mobile.currentPage()!=='compare')return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();movePhoto(event.key==='ArrowLeft'?-1:1,preview);}else if(event.key==='Enter'&&!event.target.closest('button,a,summary')){event.preventDefault();selectPhoto(preview?byId(state.previewId):activePhoto());}});
  window.addEventListener('beforeunload',event=>{if(state.photos.length||state.load||state.exporting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;disposeZipBatches();stopAnalysis();state.load?.controller.abort();state.exporting?.controller.abort();state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.downloadUrls.forEach(url=>URL.revokeObjectURL(url));state.selectionListUrls.forEach(url=>URL.revokeObjectURL(url));state.selectionListUrls.clear();});
  applyLanguage();
})();
