(() => {
  'use strict';
  const APP_CONFIG = window.StandaloneAssets.manifest.app;
  const Core = window.BestShotCore;
  const Groups = window.BestShotGrouping;
  const $ = selector => document.querySelector(selector);
  const translations = {
    en: {
      brandMeta:'Compare. Choose. Keep the originals.',eyebrow:'A LITTLE LESS SCROLLING. A BETTER PICK.',introTitle:'Find the photos you want to keep.',lead:'Put your shots side by side, choose your favorites, and save the originals together.',localBadge:'Fully local processing',photos:'Photos',photosHint:'Open any photo for a closer look.',add:'Add photos',clear:'Start over',dropTitle:'Drop your photos here',formats:'JPEG · PNG · still WebP',folder:'Choose a folder',emptyHint:'Nothing selected for you. Every choice is yours.',compare:'Compare',compareHint:'Choose photos A and B, then look closer.',compareEmpty:'Add a photo to start comparing.',activePhoto:'Active comparison photo',zoom:'Zoom',fit:'Fit',previous:'Previous',next:'Next',enlarge:'Open large',keyboardHint:'← → Browse the active photo · Enter Keep / unkeep · Esc Close',save:'Save',saveEmpty:'Choose photos to keep before saving.',outputFilename:'ZIP filename',metadataNote:'Original files are preserved, including any location and other metadata. Check this before sharing.',exportLimit:'This version makes one ZIP. For large collections, save a smaller selection if your browser runs out of memory.',download:'Save originals as ZIP',cancel:'Cancel',retry:'Retry unfinished photos',footer:'A single HTML file. No account, no upload.',navigation:'App navigation',keep:'Keep',kept:'Kept',unkeep:'Unkeep',view:'View photo',undo:'Undo',selectionChanged:'Selection updated',selected:'kept',loaded:'photos',failed:'unfinished',loading:'Reading photos',cancelled:'Cancelled. Finished photos and your choices are still here.',readFinished:'Photos are ready.',unsupported:'Use JPEG, PNG, or still WebP.',invalid:'Could not decode this image. Try another file.',animated:'Animated images are not supported.',emptyFile:'This file is empty.',largeImage:'This image exceeds the safe decode limit (100 megapixels or 32,768 pixels per side).',loadCancelled:'Not read. Retry to continue.',exporting:'Preparing ZIP',exportDone:'ZIP ready. Download started; check your browser’s downloads.',exportFailed:'Could not create the ZIP. Your choices are safe. Try a smaller selection, then save again.',zipLimit:'This selection exceeds the single ZIP limit. Choose fewer or smaller files and try again.',exportCancelled:'ZIP cancelled. Your choices are unchanged.',clearTitle:'Start a new selection?',clearMessage:'Photos and choices in this session will be cleared. Original files on your device will not change.',clearAction:'Start over',confirmTitle:'Confirm',confirmAction:'Continue',close:'Close',helpTitle:'How to use & notes',helpBasicsTitle:'Choose your favorites',helpStep1:'Add JPEG, PNG, or still WebP files. You can add more later without losing your choices. Unsupported or damaged files are listed separately.',helpStep2:'Open a photo to see it large, or select A and B for side-by-side comparison. On a phone, use A / B to switch between them. Keep any photos you want; Undo reverses the latest selection change.',helpStep3:'Open Save, review the selected photos, edit the ZIP name, and save. Only kept files are included. Files with the same name get unique names.',helpCompareTitle:'Closer inspection & keyboard',helpCompare:'Fit shows the whole image. At 100%, one image pixel uses one CSS pixel; at 200% / 400%, scroll the image to inspect details. Arrow keys browse the active photo. Enter toggles Keep when focus is on the page or image. Keyboard shortcuts do not run inside text fields or selectors. Esc closes a dialog.',helpPrivacyTitle:'Your photos stay with you',helpPrivacy:'Images are processed in this browser. This app has no image upload, analytics, or remote AI service. A hosted page needs its initial HTML download; a saved HTML file can open offline. ZIP export uses the original bytes without re-encoding or changing your source files.',helpLimitsTitle:'Supported files & limits',helpLimits:'Conservative grouping and manual selection. Recommendations and face detection are not included. HEIC, RAW, TIFF, animated images, and videos are not supported. Images larger than 100 megapixels or 32,768 pixels on a side are skipped. Very large ZIPs can exceed browser memory; save fewer files at a time. The optional self-extracting HTML requires DecompressionStream.',helpSessionTitle:'This is a temporary session',helpSession:'Photos, thumbnails, and choices are not saved between visits. Reloading, closing the page, or starting over clears them. Only your language choice may be stored. Save your ZIP before leaving. Cancelling a read keeps completed photos; Retry continues unfinished ones. Cancelling a ZIP keeps your selection.'
    },
    ja: {
      brandMeta:'見比べて、選んで、元のまま保存。',eyebrow:'たくさんの写真から、お気に入りを。',introTitle:'残したい一枚を、見つけよう。',lead:'写真を並べて見比べて、お気に入りを選択。元ファイルのまま、まとめて保存できます。',localBadge:'完全ローカル処理',photos:'写真',photosHint:'写真を開くと、大きく確認できます。',add:'写真を追加',clear:'最初から',dropTitle:'ここに写真をドロップ',formats:'JPEG・PNG・静止画WebP',folder:'フォルダーを選択',emptyHint:'自動では選びません。残す写真は、自分で決められます。',compare:'比較',compareHint:'AとBの写真を選んで、細部を確認。',compareEmpty:'写真を追加すると比較できます。',activePhoto:'操作する比較写真',zoom:'拡大',fit:'全体',previous:'前へ',next:'次へ',enlarge:'大きく見る',keyboardHint:'← → 操作中の写真を移動・Enter 残す／解除・Esc 閉じる',save:'保存',saveEmpty:'残す写真を選んでください。',outputFilename:'ZIPファイル名',metadataNote:'元ファイルのまま保存するため、位置情報などのメタデータも残ります。共有前にご確認ください。',exportLimit:'この版は1つのZIPを作ります。大容量でブラウザーのメモリが足りない場合は、選択枚数を減らして保存してください。',download:'元画像をZIPで保存',cancel:'中止',retry:'未完了の写真を再試行',footer:'単一HTML・アカウント不要・写真の送信なし',navigation:'アプリ内の移動',keep:'残す',kept:'選択済み',unkeep:'解除',view:'写真を見る',undo:'元に戻す',selectionChanged:'選択を変更しました',selected:'枚選択',loaded:'枚',failed:'件未完了',loading:'写真を読み込み中',cancelled:'中止しました。読み込み済みの写真と選択は残っています。',readFinished:'写真を読み込みました。',unsupported:'JPEG・PNG・静止画WebPを選んでください。',invalid:'画像を読み込めませんでした。別のファイルでお試しください。',animated:'アニメーション画像には対応していません。',emptyFile:'空のファイルです。',largeImage:'安全な読み込み上限（1億画素・一辺32,768px）を超えています。',loadCancelled:'未読込です。再試行で続けられます。',exporting:'ZIPを作成中',exportDone:'ZIPを作成し、ダウンロードを開始しました。ブラウザーの保存状況をご確認ください。',exportFailed:'ZIPを作成できませんでした。選択は残っています。枚数を減らして再度保存してください。',zipLimit:'1つのZIPで扱える容量を超えています。選択枚数や容量を減らしてください。',exportCancelled:'ZIP作成を中止しました。選択は変更されていません。',clearTitle:'最初から始めますか？',clearMessage:'この画面の写真と選択をすべてクリアします。端末の元ファイルは変更しません。',clearAction:'最初から始める',confirmTitle:'確認',confirmAction:'続ける',close:'閉じる',helpTitle:'使い方と注意事項',helpBasicsTitle:'お気に入りを選ぶ',helpStep1:'JPEG・PNG・静止画WebPを追加します。あとから追加しても選択は残ります。非対応・破損ファイルは別に表示されます。',helpStep2:'写真を開いて大きく見るか、AとBを選んで比較します。スマートフォンはA／Bで表示を切り替えます。好きな写真を何枚でも「残す」にでき、直後は「元に戻す」で取り消せます。',helpStep3:'「保存」で選択した写真を確認し、ZIP名を変更して保存します。選択済みの元ファイルだけを入れ、同名ファイルには一意な名前を付けます。',helpCompareTitle:'拡大とキーボード',helpCompare:'「全体」は画像全体を表示します。100%は画像1画素をCSSの1pxで表示し、200%・400%では画像内をスクロールして細部を確認できます。矢印キーで操作中の写真を移動します。ページや画像にフォーカスがあるときはEnterで「残す」を切り替えます。入力欄・選択欄の編集中はショートカットを動かしません。Escでダイアログを閉じます。',helpPrivacyTitle:'写真はブラウザーの中だけ',helpPrivacy:'画像はこのブラウザー内で処理します。画像のアップロード、アクセス解析、外部AIサービスはありません。公開ページは最初のHTML取得に通信します。保存したHTMLはオフラインで利用できます。ZIPには元のバイト列を入れ、画像の再圧縮や端末上の原本の変更は行いません。',helpLimitsTitle:'対応形式と制限',helpLimits:'保守的なグループ化と手動での比較・選択に対応しています。おすすめ・顔検出はありません。HEIC・RAW・TIFF・アニメーション画像・動画には非対応です。1億画素または一辺32,768pxを超える画像は読み込みません。大きなZIPはブラウザーのメモリを超える場合があります。枚数を分けて保存してください。自己展開HTMLにはDecompressionStream対応が必要です。',helpSessionTitle:'作業内容は一時的です',helpSession:'写真、サムネイル、選択状態は保存されません。再読み込み、ページを閉じる、「最初から」で消えるため、終了前にZIPを保存してください。言語設定だけを保存する場合があります。読み込みを中止しても完了分は残り、「再試行」で未完了分を続けられます。ZIPを中止しても選択は残ります。'
    }
  };
  Object.assign(translations.en,{"groupView": "Photo groups", "allPhotos": "All photos", "organize": "Organize", "analyze": "Analyze again", "groupNote": "Groups suggest photos to compare. They never choose what to keep. Similar photos may remain separate.", "automatic": "Automatic", "manual": "Manual", "single": "Single", "group": "Group", "reviewed": "Reviewed", "notReviewed": "Not reviewed", "identical": "Identical files", "pending": "Not analyzed", "checked": "Bytes checked", "uniqueSize": "No equal-size candidate", "skippedLarge": "Duplicate check skipped: over 64 MB", "unavailable": "Duplicate check unavailable", "analysisFailedFile": "Duplicate check failed; retry available", "captureOriginal": "EXIF capture", "captureDigitized": "EXIF digitized", "modified": "File modified", "unknownZone": "timezone unknown", "analyzing": "Analyzing", "hashing": "Checking original bytes", "comparing": "Comparing originals", "grouping": "Grouping similar photos", "analysisDone": "Analysis finished. Review groups before keeping photos.", "analysisCancelled": "Analysis cancelled. Photos, groups, and choices are unchanged. Analyze again to continue.", "analysisFailed": "Analysis failed. Your photos and choices are safe; try again.", "regroup": "Reset manual grouping and regroup", "regroupTitle": "Reset manual grouping?", "regroupMessage": "Rebuild all groups, including your manual changes. Kept photos and originals will not change. Cancelling analysis preserves the existing groups.", "groupChanged": "Groups updated", "duplicateWarning": "Your selection includes identical originals. All selected copies will be included with unique filenames.", "organizeHint": "Split one photo, move it to another group, or merge whole groups. These actions do not change Keep selections.", "sourceGroup": "Source group", "targetGroup": "Destination group", "photoToMove": "Photo to split or move", "splitPhoto": "Split into a single", "movePhoto": "Move photo", "mergeGroups": "Merge groups", "toggleReviewed": "Toggle reviewed", "helpGroups": "Groups use exact original bytes, conservative visual similarity, and JPEG EXIF capture/digitized time when available. File modified time is shown separately and never treated as capture time. Use Photo groups to filter Photos and Compare. Organize can split, move, merge, or mark a group reviewed, even with none kept. Undo reverses the latest group edit. Manual groups stay intact when more photos are added. Reset manual grouping rebuilds them but preserves Keep selections. Identical-file badges remain even after splitting. Missing timestamps or unavailable analysis do not prevent selection or export. Duplicate hashing is limited to 64 MB per file; unusually large originals remain usable. Similarity is only a suggestion and can be wrong."});
  Object.assign(translations.ja,{"groupView": "写真のグループ", "allPhotos": "すべての写真", "organize": "グループ整理", "analyze": "再解析", "groupNote": "比較する写真の候補をまとめます。残す写真は自動で選びません。似た写真も別の組に残ることがあります。", "automatic": "自動", "manual": "手動", "single": "単独", "group": "グループ", "reviewed": "確認済み", "notReviewed": "未確認", "identical": "同一バイト", "pending": "未解析", "checked": "バイト確認済み", "uniqueSize": "同サイズ候補なし", "skippedLarge": "重複確認を省略：64 MB超", "unavailable": "重複確認を利用できません", "analysisFailedFile": "重複確認失敗・再試行できます", "captureOriginal": "EXIF撮影日時", "captureDigitized": "EXIFデジタル化日時", "modified": "ファイル更新日時", "unknownZone": "タイムゾーン不明", "analyzing": "解析中", "hashing": "元ファイルを確認中", "comparing": "バイトを照合中", "grouping": "似た写真を整理中", "analysisDone": "解析が終わりました。グループを確認して、残す写真を選んでください。", "analysisCancelled": "解析を中止しました。写真、グループ、選択は変わりません。「再解析」で続けられます。", "analysisFailed": "解析できませんでした。写真と選択は残っています。もう一度お試しください。", "regroup": "手動の分類をリセットして再分類", "regroupTitle": "手動の分類をリセットしますか？", "regroupMessage": "手動で変更した組を含め、すべてのグループを作り直します。残す写真と原本は変わりません。解析を中止すると現在のグループが残ります。", "groupChanged": "グループを変更しました", "duplicateWarning": "同一内容の元ファイルが複数選択されています。選択したコピーはすべて別名でZIPに入ります。", "organizeHint": "写真を単独に分割、別グループへ移動、またはグループ同士を結合できます。「残す」の選択は変わりません。", "sourceGroup": "操作するグループ", "targetGroup": "移動・結合先のグループ", "photoToMove": "分割・移動する写真", "splitPhoto": "単独に分割", "movePhoto": "写真を移動", "mergeGroups": "グループを結合", "toggleReviewed": "確認済みを切り替え", "helpGroups": "元ファイルの厳密なバイト一致、保守的な見た目の類似度、取得できるJPEGのEXIF撮影・デジタル化日時からグループを作ります。ファイル更新日時は別表示し、撮影日時とは扱いません。「写真のグループ」で一覧と比較を絞り込めます。「グループ整理」で分割・移動・結合・確認済みの切替ができ、残す写真が0枚でも確認済みにできます。直後は「元に戻す」で取り消せます。写真を追加しても手動で編集した組は保たれます。「手動の分類をリセット」は組を作り直しますが、残す選択は変えません。同一バイトの表示は分割後も残ります。日時なし・解析不能でも選択と保存は可能です。64 MBを超えるファイルは重複確認を省略しますが、写真として利用できます。類似グループは参考で、誤りを含むことがあります。"});
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
  const state = { groups: [], groupFilter: '', analysis: null, inputRevision: 0, groupingRevision: 0, analysisMessage: '', photos: [], failures: [], queue: [], generation: 0, nextId: 1, load: null, exporting: null, pair: [null,null], active: 0, previewId: null, previewIds: [], fullUrls: new Map(), downloadUrls: new Set() };
  const outputFilename = $('#outputFilename');
  const defaultZipName = () => `best-shot-picker-${new Date().toLocaleDateString('sv-SE').replaceAll('-','')}`;
  outputFilename.value = defaultZipName();
  const mobile = window.AppMobileBottomBar.mount($('#appMobileBottomBar'), { initialPage: 'photos', pageTopOffset: 76 });
  const ready = () => state.photos;
  const kept = () => ready().filter(photo => photo.kept);
  const byId = id => ready().find(photo => photo.id === id);
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
    render();
  }
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
    toast.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
  }
  function renderGrid() {
    const grid=$('#photoGrid');
    for(const photo of ready()){
      let card=document.getElementById(`photo-${photo.id}`);
      if(!card){
        card=el('article','photo-card');card.id=`photo-${photo.id}`;
        const open=el('button','photo-open');open.type='button';open.dataset.id=photo.id;
        const image=el('img');image.src=photo.thumbnailUrl;image.alt='';image.loading='lazy';open.append(image);open.addEventListener('click',event=>openPreview(photo.id,event.currentTarget,comparisonPhotos()));
        const info=el('div','photo-info');const name=el('span','photo-name',photo.name);name.title=photo.name;const details=el('p','photo-details',`${photo.width} × ${photo.height} · ${sizeText(photo.size)}`);const keep=el('button','button keep-button');keep.type='button';keep.addEventListener('click',()=>selectPhoto(photo,'grid'));info.append(name,details,keep,el('p','photo-analysis'));card.append(open,info);grid.append(card);
      }
      card.hidden=!!state.groupFilter&&!state.groups.find(g=>g.id===state.groupFilter)?.ids.includes(photo.id);card.querySelector('.photo-analysis').textContent=photoAnalysisLabel(photo);
      card.classList.toggle('kept',photo.kept);card.querySelector('.photo-open').setAttribute('aria-label',`${translate('view')}: ${photo.name}`);const button=card.querySelector('.keep-button');button.textContent=translate(photo.kept?'kept':'keep');button.setAttribute('aria-pressed',String(photo.kept));button.setAttribute('aria-label',`${translate(photo.kept?'unkeep':'keep')}: ${photo.name}`);card.querySelector('.photo-details').textContent=`${photo.width} × ${photo.height} · ${sizeText(photo.size)}`;
    }
  }
  function getFullUrl(photo) { if(!state.fullUrls.has(photo.id))state.fullUrls.set(photo.id,URL.createObjectURL(photo.file));return state.fullUrls.get(photo.id); }
  function releaseUnusedFullUrls() { const live=new Set([...state.pair,state.previewId]);for(const[id,url]of state.fullUrls){if(!live.has(id)){URL.revokeObjectURL(url);state.fullUrls.delete(id);}} }
  function zoomImage(img, viewport, photo, value) { viewport.classList.toggle('zoomed',value!=='fit');img.style.width=value==='fit'?'':`${photo.width*Number(value)}px`;img.style.height=value==='fit'?'':`${photo.height*Number(value)}px`; }
  function renderCompare() {
    const candidates=comparisonPhotos();$('#compareGroupLabel').textContent=state.groupFilter?groupLabel(state.groups.find(g=>g.id===state.groupFilter)):translate('allPhotos');
    $('#compareEmpty').hidden=candidates.length>0;$('#compareWorkspace').hidden=!candidates.length;
    if(!candidates.length){releaseUnusedFullUrls();return;}
    if(!candidates.some(p=>p.id===state.pair[0]))state.pair[0]=candidates[0].id;
    if(!candidates.some(p=>p.id===state.pair[1]))state.pair[1]=candidates[1]?.id||null;
    if(!state.pair[state.active])state.active=0;
    ['A','B'].forEach((slot,index)=>{
      const photo=byId(state.pair[index]);const select=$(`#select${slot}`);const previous=select.value;
      if(Array.from(select.options).map(o=>o.value).join('|')!==candidates.map(p=>p.id).join('|')){select.replaceChildren(...candidates.map(item=>{const option=el('option','',item.name);option.value=item.id;return option;}));}
      select.value=photo?.id||'';select.disabled=!photo;
      const img=$(`#image${slot}`);if(photo){const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#viewport'+slot).scrollTo(0,0);}img.alt=photo.name;zoomImage(img,$('#viewport'+slot),photo,$('#compareZoom').value);}else{img.removeAttribute('src');img.alt='';}
      $(`#dimensions${slot}`).textContent=photo?`${photo.width} × ${photo.height}`:'';
      const button=$(`#keep${slot}`);button.disabled=!photo;button.textContent=translate(photo?.kept?'kept':'keep');button.setAttribute('aria-pressed',String(!!photo?.kept));
      $(`#slot${slot}`).disabled=!photo;$(`#slot${slot}`).classList.toggle('active',state.active===index);$(`#slot${slot}`).setAttribute('aria-pressed',String(state.active===index));document.querySelector(`[data-slot="${index}"]`).classList.toggle('is-active',state.active===index);
    });
    $('#previousButton').disabled=candidates.length<2;$('#nextButton').disabled=candidates.length<2;
    releaseUnusedFullUrls();
  }
  function renderSave() {
    const selected=kept();const duplicates=selected.map(p=>p.duplicateSetId).filter(Boolean);$('#duplicateWarning').hidden=new Set(duplicates).size===duplicates.length;$('#saveSummary').textContent=`${selected.length} ${translate('selected')} · ${sizeText(selected.reduce((sum,p)=>sum+p.size,0))}`;
    $('#selectedList').replaceChildren(...selected.map(photo=>{const row=el('li');const image=el('img');image.src=photo.thumbnailUrl;image.alt='';const open=el('button');open.type='button';open.append(el('span','',photo.name));open.title=photo.name;open.addEventListener('click',event=>openPreview(photo.id,event.currentTarget,kept()));const remove=el('button','button remove-selection',translate('unkeep'));remove.type='button';remove.setAttribute('aria-label',`${translate('unkeep')}: ${photo.name}`);remove.addEventListener('click',()=>selectPhoto(photo,'save'));row.append(image,open,remove);return row;}));
    $('#saveEmpty').hidden=!!selected.length;$('#downloadButton').disabled=!selected.length||!!state.exporting;$('#mobileSaveLabel').textContent=`${translate('save')}${selected.length?` (${selected.length})`:''}`;
  }
  function groupLabel(group){if(!group)return translate('allPhotos');const index=state.groups.indexOf(group)+1;return `${translate(group.ids.length===1?'single':'group')} ${index} · ${group.ids.length} ${translate('loaded')} · ${group.ids.filter(id=>byId(id)?.kept).length} ${translate('selected')} · ${translate(group.manual?'manual':'automatic')}${group.reviewed?' · '+translate('reviewed'):''}`;}
  function comparisonPhotos(){const group=state.groups.find(g=>g.id===state.groupFilter);return group?group.ids.map(byId).filter(Boolean):ready();}
  function photoAnalysisLabel(photo){const status={pending:'pending','unique-size':'uniqueSize',checked:'checked',duplicate:'identical','skipped-large':'skippedLarge',unavailable:'unavailable',failed:'analysisFailedFile'}[photo.duplicateStatus]||'pending';const time=photo.captureTime;const text=time?`${translate(time.source==='exif-original'?'captureOriginal':'captureDigitized')}: ${time.display}${time.domain==='wall'?' ('+translate('unknownZone')+')':''}`:`${translate('modified')}: ${new Date(photo.timestamp).toLocaleString(language)}`;return `${translate(status)} · ${text}`;}
  function setOptions(select,entries,value){select.replaceChildren(...entries.map(([id,text])=>{const option=el('option','',text);option.value=id;return option;}));if(entries.some(([id])=>id===value))select.value=value;}
  function renderGroups(){
    $('#groupTools').hidden=!ready().length;if(!state.groups.some(g=>g.id===state.groupFilter))state.groupFilter='';
    setOptions($('#groupFilter'),[['',translate('allPhotos')],...state.groups.map(g=>[g.id,groupLabel(g)])],state.groupFilter);
    $('#groupList').replaceChildren(...state.groups.map(group=>{const button=el('button','button group-chip'+(state.groupFilter===group.id?' active':''),groupLabel(group));button.type='button';button.dataset.groupId=group.id;button.setAttribute('aria-pressed',String(state.groupFilter===group.id));button.addEventListener('click',()=>{state.groupFilter=state.groupFilter===group.id?'':group.id;render();$('#groupFilter').focus({preventScroll:true});});return button;}));
    const duplicateSets=new Set(ready().map(p=>p.duplicateSetId).filter(Boolean));$('#groupSummary').textContent=`${state.groups.filter(g=>g.ids.length>1).length} ${translate('group')} · ${state.groups.filter(g=>g.ids.length===1).length} ${translate('single')} · ${duplicateSets.size} ${translate('identical')}`;
    $('#organizeButton').disabled=!state.groups.length||!!state.load;$('#analyzeButton').disabled=!!state.analysis||!!state.load;$('#regroupButton').disabled=!!state.analysis||!!state.load;$('#analysisResult').textContent=state.analysisMessage?translate(state.analysisMessage):'';
  }
  function stopAnalysis(){const job=state.analysis;if(job){job.controller.abort();state.analysis=null;}$('#analysisProgress').hidden=true;}
  async function analyzePhotos(reset=false){
    if(state.load||$('#groupDialog').open||!ready().length)return;stopAnalysis();const job={controller:new AbortController(),generation:state.generation,input:state.inputRevision,groups:state.groupingRevision};state.analysis=job;state.analysisMessage='';$('#analysisProgress').hidden=false;
    const current=()=>state.analysis===job&&job.generation===state.generation&&job.input===state.inputRevision&&job.groups===state.groupingRevision&&!job.controller.signal.aborted;
    const progress=(key,done,total)=>{if(!current())return;$('#analysisStatus').textContent=`${translate(key)} ${done} / ${total}`;$('#analysisMeter').max=Math.max(1,total);$('#analysisMeter').value=done;};
    renderGroups();try{
      const originals=ready().map(p=>({id:p.id,file:p.file,size:p.size}));
      const exact=await Core.findExactDuplicates(originals,{signal:job.controller.signal,onProgress:p=>progress(p.phase==='comparing'?'comparing':'hashing',p.completedFiles,p.totalFiles)});if(!current())return;
      const duplicateIds=new Map();exact.sets.forEach(ids=>ids.forEach(id=>duplicateIds.set(id,`duplicate-${ids[0]}`)));
      const records=ready().map(p=>({id:p.id,features:p.features,captureTime:p.captureTime,duplicateSetId:duplicateIds.get(p.id)||null}));
      const groups=await Groups.groupPhotos(records,{previousGroups:reset?[]:state.groups.filter(g=>!g.pending||g.manual),signal:job.controller.signal,onProgress:p=>progress('grouping',p.processed,p.total)});if(!current())return;
      // Commit IDs/analysis only. File references and the user's Keep choices never come from a snapshot.
      for(const photo of ready()){photo.duplicateSetId=duplicateIds.get(photo.id)||null;photo.duplicateStatus=exact.statuses[photo.id]||'failed';}state.groups=groups;state.analysisMessage='analysisDone';
    }catch(error){if(current())state.analysisMessage=error.name==='AbortError'?'analysisCancelled':'analysisFailed';}
    finally{if(state.analysis===job){state.analysis=null;$('#analysisProgress').hidden=true;render();}}
  }
  function refreshGroupDialog(){
    const source=state.groups.find(g=>g.id===$('#sourceGroup').value)||state.groups[0];if(!source)return;
    setOptions($('#groupPhoto'),source.ids.map(id=>[id,byId(id)?.name||id]),$('#groupPhoto').value);
    setOptions($('#targetGroup'),state.groups.filter(g=>g.id!==source.id).map(g=>[g.id,groupLabel(g)]),$('#targetGroup').value);
    $('#splitGroupButton').disabled=source.ids.length<2;$('#moveGroupButton').disabled=state.groups.length<2;$('#mergeGroupButton').disabled=state.groups.length<2;$('#reviewGroupButton').textContent=translate('toggleReviewed')+' · '+translate(source.reviewed?'reviewed':'notReviewed');
  }
  function organizeGroups(){if(state.analysis){stopAnalysis();state.analysisMessage='analysisCancelled';renderGroups();}setOptions($('#sourceGroup'),state.groups.map(g=>[g.id,groupLabel(g)]),state.groupFilter||state.groups[0]?.id);refreshGroupDialog();$('#groupDialog').showModal();}
  function editGroup(type){
    stopAnalysis();const generation=state.generation;const result=Groups.editGroups(state.groups,{type,sourceId:$('#sourceGroup').value,targetId:$('#targetGroup').value,photoId:$('#groupPhoto').value});state.groupingRevision++;state.groups=result.groups;state.analysisMessage='';$('#groupDialog').close();$('#groupToastHost').append($('#appToast'));render();
    const restore=()=>$('#organizeButton').focus({preventScroll:true});showToast(translate('groupChanged'),{messageKey:'groupChanged',actionLabel:translate('undo'),duration:7000,onRestoreFocus:restore,onAction:()=>{if(state.generation!==generation)return;stopAnalysis();state.groupingRevision++;state.groups=Groups.undoEdit(state.groups,result.patch);render();restore();}});$('#appToast').scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});
  }
  $('#groupFilter').addEventListener('change',event=>{state.groupFilter=event.target.value;render();});$('#organizeButton').addEventListener('click',organizeGroups);$('#sourceGroup').addEventListener('change',refreshGroupDialog);$('#closeGroupButton').addEventListener('click',()=>$('#groupDialog').close());
  for(const [id,type] of [['splitGroupButton','split'],['moveGroupButton','move'],['mergeGroupButton','merge'],['reviewGroupButton','review']])$('#'+id).addEventListener('click',()=>editGroup(type));
  $('#analyzeButton').addEventListener('click',()=>void analyzePhotos());$('#cancelAnalysisButton').addEventListener('click',()=>{stopAnalysis();state.analysisMessage='analysisCancelled';render();});
  $('#regroupButton').addEventListener('click',async()=>{if(await AppConfirm.ask({title:translate('regroupTitle'),message:translate('regroupMessage'),confirmLabel:translate('analyze'),cancelLabel:translate('cancel')})){state.groupingRevision++;void analyzePhotos(true);}});
  $('#groupDialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close();});
  function failureText(code) { return translate(({UNSUPPORTED_IMAGE:'unsupported',INVALID_IMAGE:'invalid',ANIMATED_IMAGE:'animated',IMAGE_TOO_LARGE:'largeImage',EMPTY:'emptyFile',CANCELLED:'loadCancelled'})[code]||'invalid'); }
  function renderErrors() { $('#errorsPanel').hidden=!state.failures.length;$('#errorsSummary').textContent=`${state.failures.length} ${translate('failed')}`;$('#errorList').replaceChildren(...state.failures.map(item=>el('li','',`${item.file.name}: ${failureText(item.code)}`)));$('#retryButton').disabled=!!state.load; }
  function render() { $('#sessionSummary').textContent=summary();$('#clearButton').disabled=!ready().length&&!state.failures.length&&!state.load;$('#emptyHint').hidden=!!ready().length;$('#dropZone').classList.toggle('compact',!!ready().length);renderGroups();renderGrid();renderCompare();renderSave();renderErrors();renderPreview();mobile.setEnabled('compare',!!ready().length);if(state.load)updateLoadProgress(); }
  function assertCurrent(generation,signal){if(generation!==state.generation||signal.aborted)throw new DOMException('Cancelled','AbortError');}
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
      return {id:`p${state.nextId++}`,file,name:file.name,size:file.size,mime:header.format,width,height,orientation:header.orientation,thumbnailUrl,kept:false,features,captureTime:header.captureTime||null,duplicateSetId:null,duplicateStatus:'pending',timestamp:file.lastModified,timestampSource:'file-last-modified'};
    }catch(error){if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);throw error;}finally{image.src='';URL.revokeObjectURL(url);}
  }
  function updateLoadProgress(){const job=state.load;if(!job)return;$('#loadStatus').textContent=`${translate('loading')} ${job.done} / ${job.total}`;$('#loadMeter').max=Math.max(1,job.total);$('#loadMeter').value=job.done;}
  async function runQueue() {
    if(state.load||!state.queue.length)return;
    const job={controller:new AbortController(),generation:state.generation,done:0,total:state.queue.length};state.load=job;$('#loadProgress').hidden=false;render();
    try{
      while(state.queue.length){assertCurrent(job.generation,job.controller.signal);const file=state.queue.shift();try{const photo=await decodePhoto(file,job.generation,job.controller.signal);assertCurrent(job.generation,job.controller.signal);state.photos.push(photo);state.groups.push({id:`g-${photo.id}`,ids:[photo.id],manual:false,reviewed:false,pending:true});}catch(error){if(job.generation!==state.generation)break;state.failures.push({file,code:error.name==='AbortError'?'CANCELLED':error.code||'INVALID_IMAGE'});if(error.name==='AbortError')break;}job.done++;render();await new Promise(resolve=>setTimeout(resolve,0));}
    }catch(error){if(error.name!=='AbortError')showToast(translate('invalid'));}
    finally{
      if(job.generation===state.generation){if(job.controller.signal.aborted){state.failures.push(...state.queue.splice(0).map(file=>({file,code:'CANCELLED'})));$('#loadStatus').textContent=translate('cancelled');}else $('#loadStatus').textContent=translate('readFinished');}
      if(state.load===job){state.load=null;$('#loadProgress').hidden=true;render();if(state.photos.length)void analyzePhotos();}
    }
  }
  function addFiles(files){const list=Array.from(files);if(!list.length)return;state.inputRevision++;stopAnalysis();state.queue.push(...list);if(state.load){state.load.total+=list.length;updateLoadProgress();}else void runQueue();}
  function activePhoto(){return byId(state.pair[state.active]);}
  function movePhoto(delta,preview=false){const candidates=preview?state.previewIds.map(byId).filter(Boolean):comparisonPhotos();const id=preview?state.previewId:state.pair[state.active];const index=candidates.findIndex(p=>p.id===id);if(!candidates.length)return;const next=candidates[(index+delta+candidates.length)%candidates.length];if(preview){state.previewId=next.id;$('#previewZoom').value='fit';renderPreview();releaseUnusedFullUrls();}else{state.pair[state.active]=next.id;renderCompare();}}
  let previewReturnHost = $('#toastHost');
  function openPreview(id,opener,candidates){previewReturnHost=opener.closest('.photo-card')?.querySelector('.photo-info') || (opener.closest('#savePage') ? $('#saveToastHost') : document.querySelector(`[data-slot="${state.active}"]`)) || $('#toastHost');if(!byId(id))return;state.previewIds=candidates.map(p=>p.id);if(!state.previewIds.includes(id))state.previewIds=[id,...state.previewIds];state.previewId=id;$('#previewZoom').value='fit';renderPreview();if(!$('#previewDialog').open)$('#previewDialog').showModal();$('#previewToastHost').append($('#appToast'));}
  function renderPreview(){const photo=byId(state.previewId);if(!photo)return;$('#previewName').textContent=photo.name;const img=$('#previewImage');const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#previewViewport').scrollTo(0,0);}img.alt=photo.name;zoomImage(img,$('#previewViewport'),photo,$('#previewZoom').value);$('#previewKeep').textContent=translate(photo.kept?'kept':'keep');$('#previewKeep').setAttribute('aria-pressed',String(photo.kept));$('#previewPrevious').disabled=state.previewIds.filter(byId).length<2;$('#previewNext').disabled=state.previewIds.filter(byId).length<2;}
  function setExportMessage(key){$('#exportResult').dataset.messageKey=key;$('#exportResult').textContent=key?translate(key):'';}
  async function exportZip(){if(state.exporting||!kept().length)return;const files=kept().map(photo=>photo.file);const job={controller:new AbortController(),generation:state.generation};state.exporting=job;const name=Core.zipFilename(outputFilename.value,defaultZipName()+'.zip');outputFilename.value=name.replace(/\.zip$/i,'');setExportMessage('');$('#exportProgress').hidden=false;$('#exportMeter').value=0;renderSave();
    try{const blob=await Core.createZip(files,{signal:job.controller.signal,onProgress:progress=>{if(state.exporting!==job||job.generation!==state.generation)return;$('#exportMeter').max=Math.max(1,progress.totalBytes);$('#exportMeter').value=progress.processedBytes;$('#exportStatus').textContent=`${translate('exporting')} ${progress.completedFiles} / ${progress.totalFiles}`;}});assertCurrent(job.generation,job.controller.signal);const url=URL.createObjectURL(blob);state.downloadUrls.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>{URL.revokeObjectURL(url);state.downloadUrls.delete(url);},60000);setExportMessage('exportDone');}
    catch(error){if(job.generation===state.generation)setExportMessage(error.name==='AbortError'?'exportCancelled':error.code==='ZIP_LIMIT'?'zipLimit':'exportFailed');}
    finally{if(state.exporting===job){state.exporting=null;$('#exportProgress').hidden=true;renderSave();}}
  }
  function resetSession(){ $('#toastHost').append($('#appToast'));stopAnalysis();state.groups=[];state.groupFilter='';state.analysisMessage='';state.inputRevision++;state.groupingRevision++;if($('#groupDialog').open)$('#groupDialog').close();state.generation++;state.load?.controller.abort();state.exporting?.controller.abort();state.load=null;state.exporting=null;state.queue=[];state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.photos=[];state.failures=[];state.pair=[null,null];state.previewId=null;state.previewIds=[];state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.fullUrls.clear();$('#photoGrid').replaceChildren();$('#selectA').replaceChildren();$('#selectB').replaceChildren();['#imageA','#imageB','#previewImage'].forEach(selector=>$(selector).removeAttribute('src'));$('#loadProgress').hidden=true;$('#exportProgress').hidden=true;setExportMessage('');if($('#previewDialog').open)$('#previewDialog').close();AppToast.dismiss();mobile.showPage('photos');render();}
  $('#addButton').addEventListener('click',()=>$('#fileInput').click());$('#fileInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});$('#folderButton').hidden=!('webkitdirectory' in document.createElement('input'));$('#folderButton').addEventListener('click',()=>$('#folderInput').click());$('#folderInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});
  const drop=$('#dropZone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag-over');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,()=>drop.classList.remove('drag-over')));drop.addEventListener('drop',event=>{event.preventDefault();addFiles(event.dataTransfer.files);});window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>event.preventDefault());
  $('#cancelLoadButton').addEventListener('click',()=>state.load?.controller.abort());$('#retryButton').addEventListener('click',()=>{const files=state.failures.map(item=>item.file);state.failures=[];addFiles(files);});$('#cancelExportButton').addEventListener('click',()=>state.exporting?.controller.abort());$('#downloadButton').addEventListener('click',exportZip);
  $('#clearButton').addEventListener('click',async()=>{if(await AppConfirm.ask({title:translate('clearTitle'),message:translate('clearMessage'),confirmLabel:translate('clearAction'),cancelLabel:translate('cancel'),tone:'danger'}))resetSession();});
  ['A','B'].forEach((slot,index)=>{$(`#slot${slot}`).addEventListener('click',()=>{state.active=index;renderCompare();});$(`#select${slot}`).addEventListener('change',event=>{state.active=index;state.pair[index]=event.target.value;renderCompare();});$(`#keep${slot}`).addEventListener('click',()=>{state.active=index;selectPhoto(byId(state.pair[index]));});});$('#compareZoom').addEventListener('change',renderCompare);$('#previousButton').addEventListener('click',()=>movePhoto(-1));$('#nextButton').addEventListener('click',()=>movePhoto(1));$('#openPreviewButton').addEventListener('click',event=>openPreview(state.pair[state.active],event.currentTarget,comparisonPhotos()));$('#previewPrevious').addEventListener('click',()=>movePhoto(-1,true));$('#previewNext').addEventListener('click',()=>movePhoto(1,true));$('#previewKeep').addEventListener('click',()=>selectPhoto(byId(state.previewId)));$('#previewZoom').addEventListener('change',renderPreview);
  $('#languageButton').addEventListener('click',()=>{language=language==='ja'?'en':'ja';writeStorage(storageKeys.language,language);applyLanguage();});$('#helpButton').addEventListener('click',()=>$('#helpDialog').showModal());$('#closeHelpButton').addEventListener('click',()=>$('#helpDialog').close());$('#closePreviewButton').addEventListener('click',()=>$('#previewDialog').close());
  [$('#helpDialog'),$('#previewDialog')].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));$('#previewDialog').addEventListener('close',()=>{const hadPreview=!!state.previewId;state.previewId=null;$('#previewImage').removeAttribute('src');const toast=$('#appToast');(previewReturnHost.isConnected ? previewReturnHost : $('#toastHost')).append(toast);if(hadPreview&&toast.classList.contains('show'))toast.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});releaseUnusedFullUrls();});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;if($('#helpDialog').open||$('#appConfirmDialog').open||$('#groupDialog').open)return;const preview=$('#previewDialog').open;if(!preview&&window.matchMedia('(max-width:600px)').matches&&mobile.currentPage()!=='compare')return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();movePhoto(event.key==='ArrowLeft'?-1:1,preview);}else if(event.key==='Enter'&&!event.target.closest('button,a')){event.preventDefault();selectPhoto(preview?byId(state.previewId):activePhoto());}});
  window.addEventListener('beforeunload',event=>{if(state.photos.length||state.load||state.exporting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;stopAnalysis();state.load?.controller.abort();state.exporting?.controller.abort();state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.downloadUrls.forEach(url=>URL.revokeObjectURL(url));});
  applyLanguage();
})();
