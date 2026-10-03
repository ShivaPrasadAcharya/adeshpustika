/* Adeshpustika catalogue. All file names and remarks are rendered as text. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const folders = [
    {key:'all', label:'All files', icon:'folder'},
    {key:'pdf', label:'PDFs', icon:'file'},
    {key:'images', label:'Images', icon:'image'},
    {key:'docs', label:'Documents', icon:'file'},
    {key:'spreadsheet', label:'Spreadsheets', icon:'grid'},
    {key:'powerpoints', label:'PowerPoints', icon:'slides'}
  ];
  const folderKeys = new Set(folders.slice(1).map(f => f.key));
  const data = window.RAYA_INDEX || {files:[], generatedAt:null};
  const clean = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ').trim();
  // Nepali character mappings supplied for optional, space-insensitive search.
  const NepaliNormalizer = {
    vowelMap: {'ी':'ि', 'ू':'ु', 'ृ':'ि', 'ऋ':'रि'},
    sibilantMap: {'श':'स', 'ष':'स'},
    nasalMap: {'ङ':'न', 'ण':'न', 'ञ':'न', 'ं':'न्'},
    vaBaMap: {'व':'ब'},
    numberMap: {'०':'0','१':'1','२':'2','३':'3','४':'4','५':'5','६':'6','७':'7','८':'8','९':'9'},
    _isDropped(ch, ignoreSpaces) {
      if (ch === '\u200D' || ch === '\u200C') return true;
      if (ignoreSpaces && /\s/.test(ch)) return true;
      return false;
    },
    _transformChar(ch) {
      let s = ch;
      for (const [f,t] of Object.entries(this.vowelMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.sibilantMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.nasalMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.vaBaMap)) if (s === f) s = t;
      for (const [f,t] of Object.entries(this.numberMap)) if (s === f) s = t;
      return s;
    },
    normalize(text, opts = {}) {
      if (!text) return '';
      return this._normalizeWithMap(text, opts).text;
    },
    _normalizeWithMap(text, opts = {}) {
      const ignoreSpaces = !!opts.ignoreSpaces;
      const src = text.normalize('NFC');
      let out = '';
      const indexMap = [];
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (this._isDropped(ch, ignoreSpaces)) continue;
        const mapped = this._transformChar(ch);
        for (const outCh of mapped) {out += outCh; indexMap.push(i);}
      }
      return {text:out, indexMap};
    },
    isDevanagari(text) {return /[\u0900-\u097F]/.test(text);},
    mapToOriginal(normPos, original, normalized, opts = {}) {
      const {indexMap} = this._normalizeWithMap(original, opts);
      if (normPos <= 0) return 0;
      if (normPos >= indexMap.length) return original.length;
      return indexMap[normPos];
    },
    search(query, text) {
      if (!query || !text) return [];
      const normQuery = this._normalizeWithMap(query, {ignoreSpaces:true}).text;
      const {text:normText, indexMap} = this._normalizeWithMap(text, {ignoreSpaces:true});
      if (!normQuery) return [];
      const matches = [];
      let fromIndex = 0;
      while (fromIndex <= normText.length) {
        const idx = normText.indexOf(normQuery, fromIndex);
        if (idx === -1) break;
        const startOrig = indexMap[idx];
        const endOrig = indexMap[idx + normQuery.length - 1] + 1;
        matches.push({start:startOrig, end:endOrig});
        fromIndex = idx + 1;
      }
      return matches;
    },
    matches(query, text) {return this.search(query, text).length > 0;}
  };
  const collator = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
  const files = (Array.isArray(data.files) ? data.files : []).filter(f => {
    if (!f || typeof f.path !== 'string' || !f.path.startsWith('Files/')) return false;
    const segments = f.path.split('/');
    return segments.length >= 3 && folderKeys.has(segments[1]) && !segments.some(s => !s || s === '.' || s === '..' || /[\\\u0000-\u001f]/.test(s));
  }).map(f => ({...f, folder:f.path.split('/')[1], name:String(f.name || f.path.split('/').pop()), remarks:String(f.remarks || ''), extension:String(f.extension || f.path.split('.').pop()).toLocaleLowerCase()}));
  const state = {folder:'all', page:1, filtered:[], matches:[], activeMatch:-1, matchRanges:new Map(), matchedRows:0, hasSearch:false};
  const advancedIds = ['match-mode','search-field','extension','name-filter','remarks-filter','exclude-filter','has-remarks'];
  const defaults = {'match-mode':'all','search-field':'all','extension':'','name-filter':'','remarks-filter':'','exclude-filter':'','has-remarks':false};
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`#i-${name}`); svg.append(use); return svg;
  }
  function element(tag, className, text) {
    const e = document.createElement(tag); if (className) e.className = className;
    if (text !== undefined) e.textContent = text; return e;
  }
  function encodedPath(path) { return path.split('/').map(encodeURIComponent).join('/'); }
  function tokens(value) { return (clean(value).match(/"[^"]+"|[^\s,]+/g) || []).map(t => t.replace(/^"|"$/g,'')); }
  function advancedCount() {return advancedIds.filter(id => ($(id).type === 'checkbox' ? $(id).checked : $(id).value) !== defaults[id]).length;}
  function fileUrl(file) {return new URL(encodedPath(file.path), document.baseURI).href;}
  function bytes(n) { if (!Number.isFinite(n)) return ''; if (n < 1024) return `${n} B`; if (n < 1048576) return `${(n/1024).toFixed(1)} KB`; return `${(n/1048576).toFixed(1)} MB`; }
  function folderNavigation() {
    const nav = $('folders'); nav.replaceChildren();
    for (const folder of folders) {
      const count = folder.key === 'all' ? files.length : files.filter(f => f.folder === folder.key).length;
      const b = element('button',`folder-button${folder.key===state.folder?' active':''}`);
      b.type = 'button'; b.setAttribute('aria-pressed', String(folder.key===state.folder));
      b.append(icon(folder.icon), element('span','',folder.label), element('span','folder-count',String(count)));
      b.addEventListener('click', () => {state.folder=folder.key; state.page=1; folderNavigation(); render();});
      nav.append(b);
    }
  }
  const standardExtensions = ['pdf','jpg','jpeg','png','webp','gif','svg','doc','docx','odt','rtf','txt','md','xls','xlsx','ods','csv','tsv','ppt','pptx','odp'];
  const extensions = [...new Set([...standardExtensions, ...files.map(f=>f.extension)])].sort();
  for (const ext of extensions) {$('extension').append(new Option(ext.toUpperCase(), ext));}
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity:'grapheme'}) : null;
  function searchableWithMap(value, normalized) {
    const source=String(value ?? ''), parts=segmenter ? segmenter.segment(source) : Array.from(source).map((segment,index,array)=>({segment,index:array.slice(0,index).join('').length}));
    let compatible='';const sourceMap=[];
    for(const part of parts){const text=part.segment.normalize('NFKC'),range={start:part.index,end:part.index+part.segment.length};compatible+=text;for(let i=0;i<text.length;i++)sourceMap.push(range);}
    // Fold the whole string so context-sensitive casing keeps its original behavior.
    const lowered=compatible.toLocaleLowerCase(),lowerMap=[];let offset=0;
    for(const ch of compatible){for(let i=0;i<ch.toLocaleLowerCase().length;i++)lowerMap.push(sourceMap[offset]);offset+=ch.length;}
    let text='';const indexMap=[];
    for(let i=0;i<lowered.length;i++){
      const ch=lowered[i];if(normalized && NepaliNormalizer._isDropped(ch,true))continue;
      if(!normalized && /\s/.test(ch) && (!text || text.endsWith(' ')))continue;
      const mapped=normalized ? NepaliNormalizer._transformChar(ch) : /\s/.test(ch) ? ' ' : ch;
      for(let j=0;j<mapped.length;j++){text+=mapped[j];indexMap.push(lowerMap[i] || lowerMap[lowerMap.length-1]);}
    }
    if(!normalized && text.endsWith(' ')){text=text.slice(0,-1);indexMap.pop();}
    return {text,indexMap};
  }
  function rangesForTerms(value, terms, normalized) {
    const {text,indexMap}=searchableWithMap(value,normalized),ranges=[];
    for(const term of new Set(terms.filter(Boolean))){let from=0;while(from<=text.length){const at=text.indexOf(term,from);if(at<0)break;const first=indexMap[at],last=indexMap[at+term.length-1];if(first && last)ranges.push({start:first.start,end:last.end});from=at+term.length;}}
    ranges.sort((a,b)=>a.start-b.start || a.end-b.end);const merged=[];
    for(const range of ranges){const last=merged[merged.length-1];if(last && range.start<last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});}
    return merged;
  }
  function highlightedText(tag, className, text, ranges=[]) {
    const container=element(tag,className);let end=0;
    for(const range of ranges){container.append(document.createTextNode(text.slice(end,range.start)));const mark=element('mark','search-match',text.slice(range.start,range.end));mark.dataset.matchIndex=String(range.matchIndex);container.append(mark);end=range.end;}
    container.append(document.createTextNode(text.slice(end)));return container;
  }
  function getFiltered() {
    const normalized = $('nepali-normalized')?.checked ?? true;
    const searchText = value => normalized ? NepaliNormalizer.normalize(clean(value), {ignoreSpaces:true}) : clean(value);
    // Split words before removing spaces so All words and Any word keep their meaning.
    const query = searchText($('search').value), queryTokens = tokens($('search').value).map(searchText).filter(Boolean), mode = $('match-mode').value;
    const field = $('search-field').value, ext = $('extension').value;
    const name = searchText($('name-filter').value), remarks = searchText($('remarks-filter').value), excluded = tokens($('exclude-filter').value).map(searchText).filter(Boolean);
    const fullText=new Map();
    const candidates = files.filter(file => {
      if (state.folder !== 'all' && file.folder !== state.folder) return false;
      if (ext && file.extension !== ext) return false;
      if ($('has-remarks').checked && !file.remarks.trim()) return false;
      const full = searchText(`${file.name} ${file.folder} ${folders.find(f=>f.key===file.folder).label} ${file.remarks}`);
      fullText.set(file.path,full);
      if (excluded.some(word=>full.includes(word))) return false;
      return true;
    });
    const matchesFile=file=>{
      if (name && !searchText(file.name).includes(name)) return false;
      if (remarks && !searchText(file.remarks).includes(remarks)) return false;
      const full=fullText.get(file.path);
      const haystack = field === 'all' ? full : field === 'folder' ? searchText(`${file.folder} ${folders.find(f=>f.key===file.folder).label}`) : searchText(file[field]);
      if (!query) return true;
      if (mode === 'phrase') return haystack.includes(query.replace(/^"|"$/g,''));
      return mode === 'any' ? queryTokens.some(word=>haystack.includes(word)) : queryTokens.every(word=>haystack.includes(word));
    };
    const matching=new Set(candidates.filter(matchesFile).map(file=>file.path));
    const result=($('filter-rows')?.checked ?? true) ? candidates.filter(file=>matching.has(file.path)) : candidates;
    const sort = $('sort').value;
    result.sort((a,b) => {
      if (sort === 'folder-asc') return collator.compare(a.folder,b.folder) || collator.compare(a.name,b.name);
      return (sort === 'name-desc' ? -1 : 1) * collator.compare(a.name,b.name) || collator.compare(a.path,b.path);
    });
    state.hasSearch=!!(query || name || remarks);state.matches=[];state.matchRanges=new Map();state.matchedRows=state.hasSearch ? matching.size : 0;
    if(state.hasSearch){
      const queryTerms=mode==='phrase' ? [query.replace(/^"|"$/g,'')] : queryTokens;
      for(let fileIndex=0;fileIndex<result.length;fileIndex++){
        const file=result[fileIndex];if(!matching.has(file.path))continue;
        const terms={folder:[],name:name?[name]:[],remarks:remarks?[remarks]:[]};
        if(query){for(const key of ['folder','name','remarks'])if(field==='all' || field===key)terms[key].push(...queryTerms);}
        const ranges={};let visibleMatches=0;
        for(const key of ['folder','name','remarks']){
          ranges[key]=rangesForTerms(file[key],terms[key],normalized);
          for(const range of ranges[key]){range.matchIndex=state.matches.length;state.matches.push({fileIndex,path:file.path,field:key});visibleMatches++;}
        }
        // Folder aliases and phrases spanning fields can match a row without a visible substring.
        if(!visibleMatches){ranges.rowMatchIndex=state.matches.length;state.matches.push({fileIndex,path:file.path,field:null});}
        state.matchRanges.set(file.path,ranges);
      }
    }
    return result;
  }
  function link(file, kind) {
    const label = file.extension.toUpperCase() || 'file';
    const a = element('a',kind === 'download' ? 'download-link' : 'open-link');
    const text = kind === 'download' ? (file.downloadText || `Download ${label}`) : (file.openText || `Open ${label}`);
    a.append(icon(kind === 'download' ? 'download' : 'eye'), element('span','',text));
    a.href = fileUrl(file); a.setAttribute('aria-label',`${text}: ${file.name}`);
    if (kind === 'download') {a.download=file.name; return a;}
    a.target='_blank'; a.rel='noopener noreferrer';
    if (['pdf','png','jpg','jpeg','gif','webp','avif','bmp','svg'].includes(file.extension)) {
      a.addEventListener('click',e => {if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); preview(file);});
    } else if (['doc','docx','xls','xlsx','ppt','pptx'].includes(file.extension) && /^https?:/.test(location.protocol)) {
      a.href = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl(file))}`;
      a.title='Open with Microsoft Office web viewer';
    } else {a.title='Open original file; your browser may download this format';}
    return a;
  }
  function row(file, index) {
    const tr = document.createElement('tr'),ranges=state.matchRanges.get(file.path) || {};
    tr.dataset.filePath=file.path;if(ranges.rowMatchIndex!==undefined)tr.dataset.matchIndex=String(ranges.rowMatchIndex);
    const sn = element('td','sn',String(index));
    const folderCell = element('td','folder-cell');
    const tag = element('span','folder-tag'); tag.append(icon('folder'),highlightedText('span','',file.folder,ranges.folder)); folderCell.append(tag);
    const nameCell = element('td','name-cell'); const group = element('div','file-name');
    const type = element('span',`type-icon ${file.folder}`, file.extension.toUpperCase().slice(0,5)); type.setAttribute('aria-hidden','true');
    const titleGroup = element('div');titleGroup.append(highlightedText('span','file-title',file.name,ranges.name));
    const nested = file.path.split('/').slice(2,-1).join('/');
    titleGroup.append(element('span','file-meta',[bytes(file.size),nested].filter(Boolean).join(' · ')));
    group.append(type,titleGroup);nameCell.append(group);
    const linkCell=element('td','link-cell'),links=element('div','file-links');links.append(link(file,'open'),link(file,'download'));linkCell.append(links);
    const remarksCell=element('td','remarks-cell');remarksCell.append(highlightedText('span', file.remarks?'remarks':'no-remark',file.remarks||'—',ranges.remarks));
    tr.append(sn,folderCell,nameCell,linkCell,remarksCell);return tr;
  }
  function updateMatchNavigation() {
    const total=state.matches.length,current=state.activeMatch>=0 ? state.activeMatch+1 : 0;
    if($('match-count')){const label=total ? `${current ? `Match ${current} of ${total}` : `${total} matches`}, in ${state.matchedRows} matching ${state.matchedRows===1?'file':'files'}` : 'No search matches';$('match-count').textContent=`${current} / ${total}`;$('match-count').setAttribute('aria-label',label);$('match-count').title=label;}
    if($('match-previous'))$('match-previous').disabled=!total;if($('match-next'))$('match-next').disabled=!total;
    const active=$('file-rows').querySelector(`[data-match-index="${state.activeMatch}"]`);
    if(active){if(active.tagName==='MARK'){active.classList.add('search-match-active');active.setAttribute('aria-current','true');}active.closest('tr').classList.add('active-search-row');}
  }
  function scrollToActiveMatch() {
    const active=$('file-rows').querySelector(`[data-match-index="${state.activeMatch}"]`);if(!active)return;
    const bar=document.querySelector('.search-card'),top=active.getBoundingClientRect().top+window.scrollY-(bar ? bar.getBoundingClientRect().height+24 : 80);
    const reducedMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:Math.max(0,top),behavior:reducedMotion?'auto':'smooth'});
  }
  function navigateMatch(direction) {
    if(timer){clearTimeout(timer);timer=null;state.page=1;render();state.activeMatch=-1;}
    const total=state.matches.length;if(!total)return;
    state.activeMatch=state.activeMatch<0 ? direction>0 ? 0 : total-1 : (state.activeMatch+direction+total)%total;
    state.page=Math.floor(state.matches[state.activeMatch].fileIndex/Number($('page-size').value))+1;render(true);scrollToActiveMatch();
  }
  function render(preserveMatch=false) {
    state.filtered=getFiltered();const n=state.filtered.length,size=Number($('page-size').value),pages=Math.max(1,Math.ceil(n/size));state.page=Math.min(state.page,pages);
    const start=(state.page-1)*size,end=Math.min(start+size,n),fragment=document.createDocumentFragment();
    if(!preserveMatch)state.activeMatch=state.matches.findIndex(match=>match.fileIndex>=start && match.fileIndex<end);
    for(let i=start;i<end;i++)fragment.append(row(state.filtered[i],i+1));$('file-rows').replaceChildren(fragment);
    const folder=folders.find(f=>f.key===state.folder);$('view-title').textContent=folder.label;
    $('view-description').textContent=state.folder==='all'?'PDFs, images, documents, spreadsheets and presentations.':`Files / ${folder.key}`;
    $('total-pill').textContent=`${files.length} ${files.length===1?'file':'files'}`;
    $('result-summary').textContent=!($('filter-rows')?.checked ?? true) && state.hasSearch ? `${n} ${n===1?'file':'files'} shown · ${state.matchedRows} matching ${state.matchedRows===1?'file':'files'}` : n===files.length?`${n} ${n===1?'file':'files'} in the catalogue`:`${n} of ${files.length} files match`;
    const count=advancedCount();$('filter-count').hidden=!count;$('filter-count').textContent=count;
    const filtered=!!($('search').value.trim()||count||state.folder!=='all');$('clear-all').hidden=!filtered;
    $('empty-state').hidden=n>0;$('empty-reset').hidden=!files.length;
    $('empty-title').textContent=files.length?'No matching files':'No files added yet';
    $('empty-description').textContent=files.length?'Try a different search or clear your filters.':'Your catalogue is ready. Add files to the PDF, images, docs, spreadsheet or powerpoints folders.';
    $('page-summary').textContent=n?`${start+1}–${end} of ${n} · Page ${state.page} of ${pages}`:'0 files';
    $('previous').disabled=state.page<=1;$('next').disabled=state.page>=pages;
    updateMatchNavigation();
  }
  function resetAdvanced() {for(const id of advancedIds){if($(id).type==='checkbox')$(id).checked=defaults[id];else $(id).value=defaults[id];}state.page=1;render();}
  function resetAll() {$('search').value='';state.folder='all';resetAdvanced();folderNavigation();$('search').focus();}
  function updateTopButton() {if($('go-top'))$('go-top').hidden=window.scrollY<300 || $('preview').open;}
  window.addEventListener('scroll',updateTopButton,{passive:true});
  $('go-top')?.addEventListener('click',()=>{
    const reducedMotion=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:0,behavior:reducedMotion?'auto':'smooth'});
  });
  updateTopButton();
  let nativePreviewFullscreen=false;
  function previewIsFullscreen() {return !!$('preview-shell') && document.fullscreenElement===$('preview-shell');}
  function setPreviewExpanded(expanded) {
    if(!$('preview-fullscreen'))return;
    $('preview').classList.toggle('preview-expanded',expanded);
    const button=$('preview-fullscreen'),label=expanded?'Exit fullscreen':'Enter fullscreen';
    button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',label);button.title=label;
    button.querySelector('use').setAttribute('href',expanded?'#i-collapse':'#i-expand');
    button.querySelector('span').textContent=expanded?'Exit full screen':'Full screen';
  }
  $('preview-fullscreen')?.addEventListener('click',async()=>{
    const dialog=$('preview'),shell=$('preview-shell'),button=$('preview-fullscreen');
    if(!dialog.open)return;
    button.disabled=true;
    try {
      if(dialog.classList.contains('preview-expanded')) {
        if(document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        setPreviewExpanded(document.fullscreenElement===shell);
      } else {
        setPreviewExpanded(true);
        // Keep a full-window view when the browser cannot enter native fullscreen.
        if(shell.requestFullscreen && document.fullscreenEnabled) {
          try {await shell.requestFullscreen();}catch {/* The full-window view remains available. */}
        }
        if(!dialog.open && document.fullscreenElement===shell && document.exitFullscreen)await document.exitFullscreen();
        if(!dialog.open)setPreviewExpanded(false);
      }
    } catch {/* A browser-controlled fullscreen exit can be retried with Escape. */}
    finally {button.disabled=false;}
  });
  document.addEventListener('fullscreenchange',()=>{
    const active=previewIsFullscreen();
    if(active || nativePreviewFullscreen)setPreviewExpanded(active);
    nativePreviewFullscreen=active;
  });
  $('preview').addEventListener('cancel',event=>{
    if(!$('preview').classList.contains('preview-expanded'))return;
    event.preventDefault();
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    else setPreviewExpanded(false);
  });
  function preview(file) {
    const dialog=$('preview');setPreviewExpanded(false);$('preview-title').textContent=file.name;
    $('preview-note').textContent=file.extension==='pdf'?'PDF preview · If a preview is unavailable, use Download.':'Image preview';
    $('preview-download').href=fileUrl(file);$('preview-download').download=file.name;
    const content=$('preview-content');content.replaceChildren();
    if(file.extension==='pdf'){const frame=document.createElement('iframe');frame.title=`PDF preview: ${file.name}`;frame.src=fileUrl(file);content.append(frame);}
    else {const img=document.createElement('img');img.alt=file.name;img.src=fileUrl(file);img.addEventListener('error',()=>{content.replaceChildren(element('p','preview-fallback','Preview unavailable. Use Download to save the file.'));},{once:true});content.append(img);}
    dialog.showModal();$('preview-close').focus();updateTopButton();
  }
  $('preview-close').addEventListener('click',()=>$('preview').close());
  $('preview').addEventListener('close',()=>{
    if(previewIsFullscreen() && document.exitFullscreen)document.exitFullscreen().catch(()=>{});
    setPreviewExpanded(false);$('preview-content').replaceChildren();updateTopButton();
  });
  $('preview').addEventListener('click',e=>{if(e.target===$('preview')){const r=$('preview').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('preview').close();}});
  $('advanced-toggle').addEventListener('click',()=>{const open=$('advanced').hidden;$('advanced').hidden=!open;$('advanced-toggle').setAttribute('aria-expanded',String(open));});
  let timer; for(const id of ['search','nepali-normalized','filter-rows',...advancedIds]){const control=$(id);control?.addEventListener(control.tagName==='SELECT'||control.type==='checkbox'?'change':'input',()=>{clearTimeout(timer);timer=setTimeout(()=>{timer=null;state.page=1;render();},100);});}
  $('match-previous')?.addEventListener('click',()=>navigateMatch(-1));$('match-next')?.addEventListener('click',()=>navigateMatch(1));
  $('search').addEventListener('keydown',event=>{if(event.key!=='Enter' || event.isComposing)return;event.preventDefault();navigateMatch(event.shiftKey?-1:1);});
  $('reset-advanced').addEventListener('click',resetAdvanced);$('clear-all').addEventListener('click',resetAll);$('empty-reset').addEventListener('click',resetAll);
  $('sort').addEventListener('change',()=>{state.page=1;render();});
  $('sort-folder').addEventListener('click',()=>{$('sort').value='folder-asc';state.page=1;render();});
  $('sort-name').addEventListener('click',()=>{$('sort').value=$('sort').value==='name-asc'?'name-desc':'name-asc';state.page=1;render();});
  $('page-size').addEventListener('change',()=>{state.page=1;render();});$('previous').addEventListener('click',()=>{if(state.page>1)state.page--;render();});$('next').addEventListener('click',()=>{state.page++;render();});
  document.addEventListener('keydown',e=>{const editing=['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable;if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!$('preview').open){e.preventDefault();$('search').focus();}if(e.key==='Escape'&&e.target===$('search')){$('search').value='';state.page=1;render();}});
  if(data.generatedAt){const date=new Date(data.generatedAt);if(!Number.isNaN(date.valueOf()))$('updated-at').textContent=`Catalogue updated ${date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}`;}
  folderNavigation();render();
  if(!window.RAYA_INDEX){$('result-summary').textContent='Catalogue index could not load. Please refresh the page.';$('empty-title').textContent='Catalogue unavailable';$('empty-description').textContent='Please refresh the page or check that files-index.js is available.';}
})();
