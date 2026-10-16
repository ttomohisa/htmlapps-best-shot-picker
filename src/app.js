(() => {
  'use strict';
  const APP_CONFIG = window.StandaloneAssets.manifest.app;
  const Core = window.BestShotCore;
  const $ = selector => document.querySelector(selector);
  const translations = {
    en: {
      brandMeta:'Compare. Choose. Keep the originals.',eyebrow:'A LITTLE LESS SCROLLING. A BETTER PICK.',introTitle:'Find the photos you want to keep.',lead:'Put your shots side by side, choose your favorites, and save the originals together.',localBadge:'Photos stay in this browser',photos:'Photos',photosHint:'Open any photo for a closer look.',add:'Add photos',clear:'Start over',dropTitle:'Drop your photos here',formats:'JPEG · PNG · still WebP',folder:'Choose a folder',emptyHint:'Nothing selected for you. Every choice is yours.',compare:'Compare',compareHint:'Choose photos A and B, then look closer.',compareEmpty:'Add a photo to start comparing.',activePhoto:'Active comparison photo',zoom:'Zoom',fit:'Fit',previous:'Previous',next:'Next',enlarge:'Open large',keyboardHint:'← → Browse the active photo · Enter Keep / unkeep · Esc Close',save:'Save',saveEmpty:'Choose photos to keep before saving.',outputFilename:'ZIP filename',metadataNote:'Original files are preserved, including any location and other metadata. Check this before sharing.',exportLimit:'This version makes one ZIP. For large collections, save a smaller selection if your browser runs out of memory.',download:'Save originals as ZIP',cancel:'Cancel',retry:'Retry unfinished photos',footer:'A single HTML file. No account, no upload.',navigation:'App navigation',keep:'Keep',kept:'Kept',unkeep:'Unkeep',view:'View photo',undo:'Undo',selectionChanged:'Selection updated',selected:'kept',loaded:'photos',failed:'unfinished',loading:'Reading photos',cancelled:'Cancelled. Finished photos and your choices are still here.',readFinished:'Photos are ready.',unsupported:'Use JPEG, PNG, or still WebP.',invalid:'Could not decode this image. Try another file.',animated:'Animated images are not supported.',emptyFile:'This file is empty.',largeImage:'This image exceeds the safe decode limit (100 megapixels or 32,768 pixels per side).',loadCancelled:'Not read. Retry to continue.',exporting:'Preparing ZIP',exportDone:'ZIP ready. Download started; check your browser’s downloads.',exportFailed:'Could not create the ZIP. Your choices are safe. Try a smaller selection, then save again.',zipLimit:'This selection exceeds the single ZIP limit. Choose fewer or smaller files and try again.',exportCancelled:'ZIP cancelled. Your choices are unchanged.',clearTitle:'Start a new selection?',clearMessage:'Photos and choices in this session will be cleared. Original files on your device will not change.',clearAction:'Start over',confirmTitle:'Confirm',confirmAction:'Continue',close:'Close',helpTitle:'How to use & notes',helpBasicsTitle:'Choose your favorites',helpStep1:'Add JPEG, PNG, or still WebP files. You can add more later without losing your choices. Unsupported or damaged files are listed separately.',helpStep2:'Open a photo to see it large, or select A and B for side-by-side comparison. On a phone, use A / B to switch between them. Keep any photos you want; Undo reverses the latest selection change.',helpStep3:'Open Save, review the selected photos, edit the ZIP name, and save. Only kept files are included. Files with the same name get unique names.',helpCompareTitle:'Closer inspection & keyboard',helpCompare:'Fit shows the whole image. At 100%, one image pixel uses one CSS pixel; at 200% / 400%, scroll the image to inspect details. Arrow keys browse the active photo. Enter toggles Keep when focus is on the page or image. Keyboard shortcuts do not run inside text fields or selectors. Esc closes a dialog.',helpPrivacyTitle:'Your photos stay with you',helpPrivacy:'Images are processed in this browser. This app has no image upload, analytics, or remote AI service. A hosted page needs its initial HTML download; a saved HTML file can open offline. ZIP export uses the original bytes without re-encoding or changing your source files.',helpLimitsTitle:'Supported files & limits',helpLimits:'Manual comparison and selection only. Automatic grouping, recommendations, and face detection are not included. HEIC, RAW, TIFF, animated images, and videos are not supported. Images larger than 100 megapixels or 32,768 pixels on a side are skipped. Very large ZIPs can exceed browser memory; save fewer files at a time. The optional self-extracting HTML requires DecompressionStream.',helpSessionTitle:'This is a temporary session',helpSession:'Photos, thumbnails, and choices are not saved between visits. Reloading, closing the page, or starting over clears them. Only your language choice may be stored. Save your ZIP before leaving. Cancelling a read keeps completed photos; Retry continues unfinished ones. Cancelling a ZIP keeps your selection.'
    },
    ja: {
      brandMeta:'見比べて、選んで、元のまま保存。',eyebrow:'たくさんの写真から、お気に入りを。',introTitle:'残したい一枚を、見つけよう。',lead:'写真を並べて見比べて、お気に入りを選択。元ファイルのまま、まとめて保存できます。',localBadge:'写真はこのブラウザー内で処理',photos:'写真',photosHint:'写真を開くと、大きく確認できます。',add:'写真を追加',clear:'最初から',dropTitle:'ここに写真をドロップ',formats:'JPEG・PNG・静止画WebP',folder:'フォルダーを選択',emptyHint:'自動では選びません。残す写真は、自分で決められます。',compare:'比較',compareHint:'AとBの写真を選んで、細部を確認。',compareEmpty:'写真を追加すると比較できます。',activePhoto:'操作する比較写真',zoom:'拡大',fit:'全体',previous:'前へ',next:'次へ',enlarge:'大きく見る',keyboardHint:'← → 操作中の写真を移動・Enter 残す／解除・Esc 閉じる',save:'保存',saveEmpty:'残す写真を選んでください。',outputFilename:'ZIPファイル名',metadataNote:'元ファイルのまま保存するため、位置情報などのメタデータも残ります。共有前にご確認ください。',exportLimit:'この版は1つのZIPを作ります。大容量でブラウザーのメモリが足りない場合は、選択枚数を減らして保存してください。',download:'元画像をZIPで保存',cancel:'中止',retry:'未完了の写真を再試行',footer:'単一HTML・アカウント不要・写真の送信なし',navigation:'アプリ内の移動',keep:'残す',kept:'選択済み',unkeep:'解除',view:'写真を見る',undo:'元に戻す',selectionChanged:'選択を変更しました',selected:'枚選択',loaded:'枚',failed:'件未完了',loading:'写真を読み込み中',cancelled:'中止しました。読み込み済みの写真と選択は残っています。',readFinished:'写真を読み込みました。',unsupported:'JPEG・PNG・静止画WebPを選んでください。',invalid:'画像を読み込めませんでした。別のファイルでお試しください。',animated:'アニメーション画像には対応していません。',emptyFile:'空のファイルです。',largeImage:'安全な読み込み上限（1億画素・一辺32,768px）を超えています。',loadCancelled:'未読込です。再試行で続けられます。',exporting:'ZIPを作成中',exportDone:'ZIPを作成し、ダウンロードを開始しました。ブラウザーの保存状況をご確認ください。',exportFailed:'ZIPを作成できませんでした。選択は残っています。枚数を減らして再度保存してください。',zipLimit:'1つのZIPで扱える容量を超えています。選択枚数や容量を減らしてください。',exportCancelled:'ZIP作成を中止しました。選択は変更されていません。',clearTitle:'最初から始めますか？',clearMessage:'この画面の写真と選択をすべてクリアします。端末の元ファイルは変更しません。',clearAction:'最初から始める',confirmTitle:'確認',confirmAction:'続ける',close:'閉じる',helpTitle:'使い方と注意事項',helpBasicsTitle:'お気に入りを選ぶ',helpStep1:'JPEG・PNG・静止画WebPを追加します。あとから追加しても選択は残ります。非対応・破損ファイルは別に表示されます。',helpStep2:'写真を開いて大きく見るか、AとBを選んで比較します。スマートフォンはA／Bで表示を切り替えます。好きな写真を何枚でも「残す」にでき、直後は「元に戻す」で取り消せます。',helpStep3:'「保存」で選択した写真を確認し、ZIP名を変更して保存します。選択済みの元ファイルだけを入れ、同名ファイルには一意な名前を付けます。',helpCompareTitle:'拡大とキーボード',helpCompare:'「全体」は画像全体を表示します。100%は画像1画素をCSSの1pxで表示し、200%・400%では画像内をスクロールして細部を確認できます。矢印キーで操作中の写真を移動します。ページや画像にフォーカスがあるときはEnterで「残す」を切り替えます。入力欄・選択欄の編集中はショートカットを動かしません。Escでダイアログを閉じます。',helpPrivacyTitle:'写真はブラウザーの中だけ',helpPrivacy:'画像はこのブラウザー内で処理します。画像のアップロード、アクセス解析、外部AIサービスはありません。公開ページは最初のHTML取得に通信します。保存したHTMLはオフラインで利用できます。ZIPには元のバイト列を入れ、画像の再圧縮や端末上の原本の変更は行いません。',helpLimitsTitle:'対応形式と制限',helpLimits:'手動での比較・選択に対応しています。自動グループ化、おすすめ、顔検出はありません。HEIC・RAW・TIFF・アニメーション画像・動画には非対応です。1億画素または一辺32,768pxを超える画像は読み込みません。大きなZIPはブラウザーのメモリを超える場合があります。枚数を分けて保存してください。自己展開HTMLにはDecompressionStream対応が必要です。',helpSessionTitle:'作業内容は一時的です',helpSession:'写真、サムネイル、選択状態は保存されません。再読み込み、ページを閉じる、「最初から」で消えるため、終了前にZIPを保存してください。言語設定だけを保存する場合があります。読み込みを中止しても完了分は残り、「再試行」で未完了分を続けられます。ZIPを中止しても選択は残ります。'
    }
  };
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
      function showToast(message, options = {}) { AppToast.show({ message, ...options }); }
  const state = { photos: [], failures: [], queue: [], generation: 0, nextId: 1, load: null, exporting: null, pair: [null,null], active: 0, previewId: null, fullUrls: new Map(), downloadUrls: new Set() };
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
    $('#languageButton').textContent=language==='ja'?'EN':'日本語';
    $('#languageButton').setAttribute('aria-label',language==='ja'?'英語に切り替え':'Switch to Japanese');
    const exportMessage = $('#exportResult').dataset.messageKey;
    if(exportMessage)$('#exportResult').textContent=translate(exportMessage);
    if($('#appToast').classList.contains('show')&&!$('#appToastAction').hidden){$('#appToastMessage').textContent=translate('selectionChanged');$('#appToastAction').textContent=translate('undo');}
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
        const image=el('img');image.src=photo.thumbnailUrl;image.alt='';image.loading='lazy';open.append(image);open.addEventListener('click',()=>openPreview(photo.id));
        const info=el('div','photo-info');const name=el('span','photo-name',photo.name);name.title=photo.name;const details=el('p','photo-details',`${photo.width} × ${photo.height} · ${sizeText(photo.size)}`);const keep=el('button','button keep-button');keep.type='button';keep.addEventListener('click',()=>selectPhoto(photo,'grid'));info.append(name,details,keep);card.append(open,info);grid.append(card);
      }
      card.classList.toggle('kept',photo.kept);card.querySelector('.photo-open').setAttribute('aria-label',`${translate('view')}: ${photo.name}`);const button=card.querySelector('.keep-button');button.textContent=translate(photo.kept?'kept':'keep');button.setAttribute('aria-pressed',String(photo.kept));button.setAttribute('aria-label',`${translate(photo.kept?'unkeep':'keep')}: ${photo.name}`);card.querySelector('.photo-details').textContent=`${photo.width} × ${photo.height} · ${sizeText(photo.size)}`;
    }
  }
  function getFullUrl(photo) { if(!state.fullUrls.has(photo.id))state.fullUrls.set(photo.id,URL.createObjectURL(photo.file));return state.fullUrls.get(photo.id); }
  function releaseUnusedFullUrls() { const live=new Set([...state.pair,state.previewId]);for(const[id,url]of state.fullUrls){if(!live.has(id)){URL.revokeObjectURL(url);state.fullUrls.delete(id);}} }
  function zoomImage(img, viewport, photo, value) { viewport.classList.toggle('zoomed',value!=='fit');img.style.width=value==='fit'?'':`${photo.width*Number(value)}px`;img.style.height=value==='fit'?'':`${photo.height*Number(value)}px`; }
  function renderCompare() {
    $('#compareEmpty').hidden=ready().length>0;$('#compareWorkspace').hidden=!ready().length;
    if(!ready().length){releaseUnusedFullUrls();return;}
    if(!byId(state.pair[0]))state.pair[0]=ready()[0].id;
    if(!byId(state.pair[1]))state.pair[1]=ready()[1]?.id||null;
    if(!state.pair[state.active])state.active=0;
    ['A','B'].forEach((slot,index)=>{
      const photo=byId(state.pair[index]);const select=$(`#select${slot}`);const previous=select.value;
      if(select.options.length!==ready().length){select.replaceChildren(...ready().map(item=>{const option=el('option','',item.name);option.value=item.id;return option;}));}
      select.value=photo?.id||'';select.disabled=!photo;
      const img=$(`#image${slot}`);if(photo){const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#viewport'+slot).scrollTo(0,0);}img.alt=photo.name;zoomImage(img,$('#viewport'+slot),photo,$('#compareZoom').value);}else{img.removeAttribute('src');img.alt='';}
      $(`#dimensions${slot}`).textContent=photo?`${photo.width} × ${photo.height}`:'';
      const button=$(`#keep${slot}`);button.disabled=!photo;button.textContent=translate(photo?.kept?'kept':'keep');button.setAttribute('aria-pressed',String(!!photo?.kept));
      $(`#slot${slot}`).disabled=!photo;$(`#slot${slot}`).classList.toggle('active',state.active===index);$(`#slot${slot}`).setAttribute('aria-pressed',String(state.active===index));document.querySelector(`[data-slot="${index}"]`).classList.toggle('is-active',state.active===index);
    });
    $('#previousButton').disabled=ready().length<2;$('#nextButton').disabled=ready().length<2;
    releaseUnusedFullUrls();
  }
  function renderSave() {
    const selected=kept();$('#saveSummary').textContent=`${selected.length} ${translate('selected')} · ${sizeText(selected.reduce((sum,p)=>sum+p.size,0))}`;
    $('#selectedList').replaceChildren(...selected.map(photo=>{const row=el('li');const image=el('img');image.src=photo.thumbnailUrl;image.alt='';const open=el('button');open.type='button';open.append(el('span','',photo.name));open.title=photo.name;open.addEventListener('click',()=>openPreview(photo.id));const remove=el('button','button remove-selection',translate('unkeep'));remove.type='button';remove.setAttribute('aria-label',`${translate('unkeep')}: ${photo.name}`);remove.addEventListener('click',()=>selectPhoto(photo,'save'));row.append(image,open,remove);return row;}));
    $('#saveEmpty').hidden=!!selected.length;$('#downloadButton').disabled=!selected.length||!!state.exporting;$('#mobileSaveLabel').textContent=`${translate('save')}${selected.length?` (${selected.length})`:''}`;
  }
  function failureText(code) { return translate(({UNSUPPORTED_IMAGE:'unsupported',INVALID_IMAGE:'invalid',ANIMATED_IMAGE:'animated',IMAGE_TOO_LARGE:'largeImage',EMPTY:'emptyFile',CANCELLED:'loadCancelled'})[code]||'invalid'); }
  function renderErrors() { $('#errorsPanel').hidden=!state.failures.length;$('#errorsSummary').textContent=`${state.failures.length} ${translate('failed')}`;$('#errorList').replaceChildren(...state.failures.map(item=>el('li','',`${item.file.name}: ${failureText(item.code)}`)));$('#retryButton').disabled=!!state.load; }
  function render() { $('#sessionSummary').textContent=summary();$('#clearButton').disabled=!ready().length&&!state.failures.length&&!state.load;$('#emptyHint').hidden=!!ready().length;$('#dropZone').classList.toggle('compact',!!ready().length);renderGrid();renderCompare();renderSave();renderErrors();renderPreview();mobile.setEnabled('compare',!!ready().length);if(state.load)updateLoadProgress(); }
  function assertCurrent(generation,signal){if(generation!==state.generation||signal.aborted)throw new DOMException('Cancelled','AbortError');}
  async function decodePhoto(file,generation,signal) {
    if(!file.size)throw Object.assign(new Error('Empty'),{code:'EMPTY'});
    const header=Core.inspectImageHeader(new Uint8Array(await file.slice(0,512*1024).arrayBuffer()));assertCurrent(generation,signal);
    let url=URL.createObjectURL(file);const image=new Image();let thumbnailUrl=null;
    try{
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('Decode timeout')),30000);const onAbort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){clearTimeout(timer);signal.removeEventListener('abort',onAbort);image.onload=image.onerror=null;error?reject(error):resolve();}signal.addEventListener('abort',onAbort,{once:true});image.onload=()=>finish();image.onerror=()=>finish(new Error('Decode failed'));image.src=url;});
      assertCurrent(generation,signal);const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height)throw new Error('No dimensions');if(width*height>100000000||width>32768||height>32768)throw Object.assign(new Error('Image too large'),{code:'IMAGE_TOO_LARGE'});
      const scale=Math.min(1,480/Math.max(width,height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('No canvas');context.drawImage(image,0,0,canvas.width,canvas.height);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Thumbnail failed')),'image/png'));canvas.width=canvas.height=1;assertCurrent(generation,signal);thumbnailUrl=URL.createObjectURL(blob);
      return {id:`p${state.nextId++}`,file,name:file.name,size:file.size,mime:header.format,width,height,orientation:header.orientation,thumbnailUrl,kept:false,timestamp:file.lastModified,timestampSource:'file-last-modified'};
    }catch(error){if(thumbnailUrl)URL.revokeObjectURL(thumbnailUrl);throw error;}finally{image.src='';URL.revokeObjectURL(url);}
  }
  function updateLoadProgress(){const job=state.load;if(!job)return;$('#loadStatus').textContent=`${translate('loading')} ${job.done} / ${job.total}`;$('#loadMeter').max=Math.max(1,job.total);$('#loadMeter').value=job.done;}
  async function runQueue() {
    if(state.load||!state.queue.length)return;
    const job={controller:new AbortController(),generation:state.generation,done:0,total:state.queue.length};state.load=job;$('#loadProgress').hidden=false;render();
    try{
      while(state.queue.length){assertCurrent(job.generation,job.controller.signal);const file=state.queue.shift();try{const photo=await decodePhoto(file,job.generation,job.controller.signal);assertCurrent(job.generation,job.controller.signal);state.photos.push(photo);}catch(error){if(job.generation!==state.generation)break;state.failures.push({file,code:error.name==='AbortError'?'CANCELLED':error.code||'INVALID_IMAGE'});if(error.name==='AbortError')break;}job.done++;render();await new Promise(resolve=>setTimeout(resolve,0));}
    }catch(error){if(error.name!=='AbortError')showToast(translate('invalid'));}
    finally{
      if(job.generation===state.generation){if(job.controller.signal.aborted){state.failures.push(...state.queue.splice(0).map(file=>({file,code:'CANCELLED'})));$('#loadStatus').textContent=translate('cancelled');}else $('#loadStatus').textContent=translate('readFinished');}
      if(state.load===job){state.load=null;$('#loadProgress').hidden=true;render();}
    }
  }
  function addFiles(files){const list=Array.from(files);if(!list.length)return;state.queue.push(...list);if(state.load){state.load.total+=list.length;updateLoadProgress();}else void runQueue();}
  function activePhoto(){return byId(state.pair[state.active]);}
  function movePhoto(delta,preview=false){const id=preview?state.previewId:state.pair[state.active];const index=ready().findIndex(p=>p.id===id);if(!ready().length)return;const next=ready()[(index+delta+ready().length)%ready().length];if(preview){state.previewId=next.id;$('#previewZoom').value='fit';renderPreview();releaseUnusedFullUrls();}else{state.pair[state.active]=next.id;renderCompare();}}
  let previewReturnHost = $('#toastHost');
  function openPreview(id){const opener=document.activeElement;previewReturnHost=opener.closest('.photo-card')?.querySelector('.photo-info') || (opener.closest('#savePage') ? $('#saveToastHost') : document.querySelector(`[data-slot="${state.active}"]`)) || $('#toastHost');if(!byId(id))return;state.previewId=id;$('#previewZoom').value='fit';renderPreview();if(!$('#previewDialog').open)$('#previewDialog').showModal();$('#previewToastHost').append($('#appToast'));}
  function renderPreview(){const photo=byId(state.previewId);if(!photo)return;$('#previewName').textContent=photo.name;const img=$('#previewImage');const url=getFullUrl(photo);if(img.src!==url){img.src=url;$('#previewViewport').scrollTo(0,0);}img.alt=photo.name;zoomImage(img,$('#previewViewport'),photo,$('#previewZoom').value);$('#previewKeep').textContent=translate(photo.kept?'kept':'keep');$('#previewKeep').setAttribute('aria-pressed',String(photo.kept));$('#previewPrevious').disabled=ready().length<2;$('#previewNext').disabled=ready().length<2;}
  function setExportMessage(key){$('#exportResult').dataset.messageKey=key;$('#exportResult').textContent=key?translate(key):'';}
  async function exportZip(){if(state.exporting||!kept().length)return;const files=kept().map(photo=>photo.file);const job={controller:new AbortController(),generation:state.generation};state.exporting=job;const name=Core.zipFilename(outputFilename.value,defaultZipName()+'.zip');outputFilename.value=name.replace(/\.zip$/i,'');setExportMessage('');$('#exportProgress').hidden=false;$('#exportMeter').value=0;renderSave();
    try{const blob=await Core.createZip(files,{signal:job.controller.signal,onProgress:progress=>{if(state.exporting!==job||job.generation!==state.generation)return;$('#exportMeter').max=Math.max(1,progress.totalBytes);$('#exportMeter').value=progress.processedBytes;$('#exportStatus').textContent=`${translate('exporting')} ${progress.completedFiles} / ${progress.totalFiles}`;}});assertCurrent(job.generation,job.controller.signal);const url=URL.createObjectURL(blob);state.downloadUrls.add(url);const anchor=document.createElement('a');anchor.href=url;anchor.download=name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>{URL.revokeObjectURL(url);state.downloadUrls.delete(url);},60000);setExportMessage('exportDone');}
    catch(error){if(job.generation===state.generation)setExportMessage(error.name==='AbortError'?'exportCancelled':error.code==='ZIP_LIMIT'?'zipLimit':'exportFailed');}
    finally{if(state.exporting===job){state.exporting=null;$('#exportProgress').hidden=true;renderSave();}}
  }
  function resetSession(){ $('#toastHost').append($('#appToast'));state.generation++;state.load?.controller.abort();state.exporting?.controller.abort();state.load=null;state.exporting=null;state.queue=[];state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.photos=[];state.failures=[];state.pair=[null,null];state.previewId=null;state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.fullUrls.clear();$('#photoGrid').replaceChildren();$('#selectA').replaceChildren();$('#selectB').replaceChildren();['#imageA','#imageB','#previewImage'].forEach(selector=>$(selector).removeAttribute('src'));$('#loadProgress').hidden=true;$('#exportProgress').hidden=true;setExportMessage('');if($('#previewDialog').open)$('#previewDialog').close();AppToast.dismiss();mobile.showPage('photos');render();}
  $('#addButton').addEventListener('click',()=>$('#fileInput').click());$('#fileInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});$('#folderButton').hidden=!('webkitdirectory' in document.createElement('input'));$('#folderButton').addEventListener('click',()=>$('#folderInput').click());$('#folderInput').addEventListener('change',event=>{addFiles(event.target.files);event.target.value='';});
  const drop=$('#dropZone');['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('drag-over');}));['dragleave','drop'].forEach(type=>drop.addEventListener(type,()=>drop.classList.remove('drag-over')));drop.addEventListener('drop',event=>{event.preventDefault();addFiles(event.dataTransfer.files);});window.addEventListener('dragover',event=>event.preventDefault());window.addEventListener('drop',event=>event.preventDefault());
  $('#cancelLoadButton').addEventListener('click',()=>state.load?.controller.abort());$('#retryButton').addEventListener('click',()=>{const files=state.failures.map(item=>item.file);state.failures=[];addFiles(files);});$('#cancelExportButton').addEventListener('click',()=>state.exporting?.controller.abort());$('#downloadButton').addEventListener('click',exportZip);
  $('#clearButton').addEventListener('click',async()=>{if(await AppConfirm.ask({title:translate('clearTitle'),message:translate('clearMessage'),confirmLabel:translate('clearAction'),cancelLabel:translate('cancel'),tone:'danger'}))resetSession();});
  ['A','B'].forEach((slot,index)=>{$(`#slot${slot}`).addEventListener('click',()=>{state.active=index;renderCompare();});$(`#select${slot}`).addEventListener('change',event=>{state.active=index;state.pair[index]=event.target.value;renderCompare();});$(`#keep${slot}`).addEventListener('click',()=>{state.active=index;selectPhoto(byId(state.pair[index]));});});$('#compareZoom').addEventListener('change',renderCompare);$('#previousButton').addEventListener('click',()=>movePhoto(-1));$('#nextButton').addEventListener('click',()=>movePhoto(1));$('#openPreviewButton').addEventListener('click',()=>openPreview(state.pair[state.active]));$('#previewPrevious').addEventListener('click',()=>movePhoto(-1,true));$('#previewNext').addEventListener('click',()=>movePhoto(1,true));$('#previewKeep').addEventListener('click',()=>selectPhoto(byId(state.previewId)));$('#previewZoom').addEventListener('change',renderPreview);
  $('#languageButton').addEventListener('click',()=>{language=language==='ja'?'en':'ja';writeStorage(storageKeys.language,language);applyLanguage();});$('#helpButton').addEventListener('click',()=>$('#helpDialog').showModal());$('#closeHelpButton').addEventListener('click',()=>$('#helpDialog').close());$('#closePreviewButton').addEventListener('click',()=>$('#previewDialog').close());
  [$('#helpDialog'),$('#previewDialog')].forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}));$('#previewDialog').addEventListener('close',()=>{const hadPreview=!!state.previewId;state.previewId=null;$('#previewImage').removeAttribute('src');const toast=$('#appToast');(previewReturnHost.isConnected ? previewReturnHost : $('#toastHost')).append(toast);if(hadPreview&&toast.classList.contains('show'))toast.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});releaseUnusedFullUrls();});
  document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;if($('#helpDialog').open||$('#appConfirmDialog').open)return;const preview=$('#previewDialog').open;if(!preview&&window.matchMedia('(max-width:600px)').matches&&mobile.currentPage()!=='compare')return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();movePhoto(event.key==='ArrowLeft'?-1:1,preview);}else if(event.key==='Enter'&&!event.target.closest('button,a')){event.preventDefault();selectPhoto(preview?byId(state.previewId):activePhoto());}});
  window.addEventListener('beforeunload',event=>{if(state.photos.length||state.load||state.exporting){event.preventDefault();event.returnValue='';}});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;state.load?.controller.abort();state.exporting?.controller.abort();state.photos.forEach(photo=>URL.revokeObjectURL(photo.thumbnailUrl));state.fullUrls.forEach(url=>URL.revokeObjectURL(url));state.downloadUrls.forEach(url=>URL.revokeObjectURL(url));});
  applyLanguage();
})();
