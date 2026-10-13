(() => {
  const canvas = document.getElementById('board');
  const card = document.getElementById('canvasCard');
  const ctx = canvas.getContext('2d');
  const state = {
    tool: 'select', color: '#20242c', width: 4, brush: 'round',
    pages: [{ items: [], redo: [], background: '#ffffff' }], pageIndex: 0,
    active: null, selectedId: null, dragging: null, dpr: 1
  };
  Object.defineProperties(state, {
    items: { get: () => state.pages[state.pageIndex].items, set: (value) => { state.pages[state.pageIndex].items = value; } },
    redo: { get: () => state.pages[state.pageIndex].redo, set: (value) => { state.pages[state.pageIndex].redo = value; } },
    background: { get: () => state.pages[state.pageIndex].background, set: (value) => { state.pages[state.pageIndex].background = value; } }
  });
  const imageCache = new Map();
  let toastTimer;

  const $ = (id) => document.getElementById(id);
  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function resizeCanvas() {
    const rect = card.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * state.dpr));
    canvas.height = Math.max(1, Math.round(rect.height * state.dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    draw();
  }

  function setupContext(target, width = state.width) {
    target.lineCap = 'round'; target.lineJoin = 'round';
    target.lineWidth = width; target.strokeStyle = state.color;
  }

  function loadCachedImage(item) {
    if (imageCache.has(item.id)) return imageCache.get(item.id);
    const img = new Image();
    img.onload = draw;
    img.src = item.src;
    imageCache.set(item.id, img);
    return img;
  }

  function drawItem(c, item) {
    c.save();
    if (item.type === 'image') {
      const img = loadCachedImage(item);
      if (img.complete) c.drawImage(img, item.x, item.y, item.w, item.h);
      c.restore(); return;
    }

    c.strokeStyle = item.color;
    c.lineWidth = item.width;
    c.lineCap = item.style === 'calligraphy' ? 'square' : 'round';
    c.lineJoin = 'round';
    c.globalAlpha = item.style === 'marker' ? .38 : 1;
    if (item.style === 'neon') { c.shadowColor = item.color; c.shadowBlur = item.width * 1.8; }
    if (item.type === 'eraser') {
      c.globalCompositeOperation = 'destination-out';
      c.lineWidth = item.width;
      c.globalAlpha = 1;
    }

    if (item.type === 'stroke' || item.type === 'eraser') {
      if (!item.points.length) { c.restore(); return; }
      c.beginPath(); c.moveTo(item.points[0].x, item.points[0].y);
      if (item.points.length === 1) c.lineTo(item.points[0].x + .01, item.points[0].y + .01);
      for (let i = 1; i < item.points.length - 1; i++) {
        const mid = { x: (item.points[i].x + item.points[i + 1].x) / 2, y: (item.points[i].y + item.points[i + 1].y) / 2 };
        c.quadraticCurveTo(item.points[i].x, item.points[i].y, mid.x, mid.y);
      }
      const last = item.points[item.points.length - 1];
      c.lineTo(last.x, last.y); c.stroke(); c.restore(); return;
    }

    const { x1, y1, x2, y2 } = item;
    c.beginPath();
    if (item.type === 'line') { c.moveTo(x1, y1); c.lineTo(x2, y2); }
    if (item.type === 'rectangle') c.rect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
    if (item.type === 'circle') {
      const cx = (x1+x2)/2, cy = (y1+y2)/2;
      c.ellipse(cx, cy, Math.abs(x2-x1)/2, Math.abs(y2-y1)/2, 0, 0, Math.PI*2);
    }
    if (item.type === 'triangle') { c.moveTo((x1+x2)/2,y1); c.lineTo(x2,y2); c.lineTo(x1,y2); c.closePath(); }
    if (item.type === 'arrow') {
      const angle = Math.atan2(y2-y1,x2-x1), head = Math.max(12,item.width*3);
      c.moveTo(x1,y1); c.lineTo(x2,y2);
      c.moveTo(x2,y2); c.lineTo(x2-head*Math.cos(angle-Math.PI/6), y2-head*Math.sin(angle-Math.PI/6));
      c.moveTo(x2,y2); c.lineTo(x2-head*Math.cos(angle+Math.PI/6), y2-head*Math.sin(angle+Math.PI/6));
    }
    c.stroke(); c.restore();
  }

  function draw() {
    const w = canvas.width / state.dpr, h = canvas.height / state.dpr;
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = state.background; ctx.fillRect(0,0,w,h);

    const layer = document.createElement('canvas');
    layer.width = canvas.width; layer.height = canvas.height;
    const lc = layer.getContext('2d'); lc.setTransform(state.dpr,0,0,state.dpr,0,0);
    for (const item of state.items) drawItem(lc, item);
    if (state.active) drawItem(lc, state.active);
    ctx.drawImage(layer,0,0,w,h);

    const selected = state.items.find(i => i.id === state.selectedId && i.type === 'image');
    if (selected) {
      ctx.save(); ctx.strokeStyle = '#2864dc'; ctx.lineWidth = 2; ctx.setLineDash([6,4]);
      ctx.strokeRect(selected.x-3, selected.y-3, selected.w+6, selected.h+6);
      ctx.fillStyle = '#2864dc'; ctx.setLineDash([]);
      [[selected.x-3,selected.y-3],[selected.x+selected.w+3,selected.y-3],[selected.x-3,selected.y+selected.h+3],[selected.x+selected.w+3,selected.y+selected.h+3]].forEach(([x,y]) => ctx.fillRect(x-3,y-3,6,6));
      ctx.restore();
    }
    $('emptyHint').classList.toggle('hidden', state.items.length > 0 || !!state.active);
  }

  function commit(item) {
    state.items.push(item); state.redo = []; state.active = null;
    updateUI(); draw();
  }

  function constrainShape(item, event) {
    if (!event.shiftKey || !['rectangle','circle'].includes(item.type)) return;
    const dx = item.x2-item.x1, dy = item.y2-item.y1, size = Math.max(Math.abs(dx),Math.abs(dy));
    item.x2 = item.x1 + Math.sign(dx || 1)*size; item.y2 = item.y1 + Math.sign(dy || 1)*size;
  }

  function hitImage(p) {
    for (let i = state.items.length-1; i >= 0; i--) {
      const item = state.items[i];
      if (item.type === 'image' && p.x >= item.x && p.x <= item.x+item.w && p.y >= item.y && p.y <= item.y+item.h) return item;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    if (state.tool === 'select') {
      const image = hitImage(p); state.selectedId = image?.id || null;
      state.dragging = image ? { id:image.id, px:p.x, py:p.y, ox:image.x, oy:image.y, moved:false } : null;
      updateUI(); draw(); return;
    }
    state.selectedId = null;
    if (['pen','brush','eraser'].includes(state.tool)) {
      state.active = { id:uid(), type:state.tool === 'eraser'?'eraser':'stroke', points:[p], color:state.color, width:state.tool==='eraser'?Math.max(12,state.width*2.4):state.width, style:state.tool==='brush'?state.brush:'round' };
    } else {
      state.active = { id:uid(), type:state.tool, x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:state.color,width:state.width,style:'round' };
    }
    draw();
  });

  canvas.addEventListener('pointermove', (event) => {
    const p = point(event);
    if (state.dragging) {
      const item = state.items.find(i => i.id === state.dragging.id);
      if (item) { item.x = state.dragging.ox+p.x-state.dragging.px; item.y = state.dragging.oy+p.y-state.dragging.py; state.dragging.moved = true; draw(); }
      return;
    }
    if (!state.active) return;
    if ('points' in state.active) {
      if (distance(state.active.points.at(-1), p) > 1.5) state.active.points.push(p);
    } else { state.active.x2=p.x; state.active.y2=p.y; constrainShape(state.active,event); }
    draw();
  });

  function finishPointer() {
    if (state.dragging) {
      if (state.dragging.moved) { state.redo=[]; updateUI(); }
      state.dragging=null; return;
    }
    if (!state.active) return;
    const valid = 'points' in state.active ? true : distance({x:state.active.x1,y:state.active.y1},{x:state.active.x2,y:state.active.y2}) > 2;
    if (valid) commit(state.active); else { state.active=null; draw(); }
  }
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);

  function setTool(tool) {
    state.tool = tool; state.selectedId = tool === 'select' ? state.selectedId : null;
    document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    const cursors = { select:'default', pen:'crosshair', brush:'crosshair', eraser:'cell' };
    canvas.style.cursor = cursors[tool] || 'crosshair';
    $('brushStyleGroup').style.display = tool === 'brush' ? 'block' : 'none';
    $('statusText').textContent = `${tool[0].toUpperCase()+tool.slice(1)} tool`;
    updateUI(); draw();
  }

  document.querySelectorAll('.tool').forEach(btn => btn.addEventListener('click', () => setTool(btn.dataset.tool)));
  document.querySelectorAll('[data-color]').forEach(btn => btn.addEventListener('click', () => {
    state.color=btn.dataset.color; $('strokeColor').value=state.color;
    document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('active',b===btn));
  }));
  document.querySelectorAll('[data-bg]').forEach(btn => btn.addEventListener('click', () => {
    state.background=btn.dataset.bg; document.documentElement.style.setProperty('--canvas-bg',state.background); $('backgroundColor').value=state.background;
    document.querySelectorAll('[data-bg]').forEach(b => b.classList.toggle('active',b===btn)); draw();
  }));
  $('customStrokeBtn').onclick=()=>$('strokeColor').click();
  $('customBgBtn').onclick=()=>$('backgroundColor').click();
  $('strokeColor').oninput=(e)=>{ state.color=e.target.value; document.querySelectorAll('[data-color]').forEach(b=>b.classList.remove('active')); };
  $('backgroundColor').oninput=(e)=>{ state.background=e.target.value; document.documentElement.style.setProperty('--canvas-bg',state.background); document.querySelectorAll('[data-bg]').forEach(b=>b.classList.remove('active')); draw(); };
  $('strokeWidth').oninput=(e)=>{ state.width=Number(e.target.value); $('sizeValue').textContent=`${state.width} px`; };
  $('brushStyle').onchange=(e)=>state.brush=e.target.value;

  function updateUI() {
    $('undoBtn').disabled = !state.items.length;
    $('redoBtn').disabled = !state.redo.length;
    $('selectionPanel').hidden = !state.selectedId;
    $('pageCounter').textContent = `${state.pageIndex + 1} / ${state.pages.length}`;
    $('previousPageBtn').disabled = state.pageIndex === 0;
    $('nextPageBtn').disabled = state.pageIndex === state.pages.length - 1;
  }
  function undo() { if (!state.items.length) return; state.selectedId=null; state.redo.push(state.items.pop()); updateUI(); draw(); }
  function redo() { if (!state.redo.length) return; state.items.push(state.redo.pop()); updateUI(); draw(); }
  $('undoBtn').onclick=undo; $('redoBtn').onclick=redo;
  $('clearBtn').onclick=()=>{ if (!state.items.length || !confirm(`Clear everything from page ${state.pageIndex + 1}?`)) return; state.redo=[...state.items]; state.items=[]; state.selectedId=null; updateUI(); draw(); showToast('Page cleared'); };
  function deleteSelected() { const idx=state.items.findIndex(i=>i.id===state.selectedId); if(idx<0)return; state.redo=[]; state.items.splice(idx,1); state.selectedId=null; updateUI(); draw(); showToast('Image deleted'); }
  $('deleteBtn').onclick=deleteSelected;

  function syncPageAppearance() {
    document.documentElement.style.setProperty('--canvas-bg', state.background);
    $('backgroundColor').value = state.background;
    document.querySelectorAll('[data-bg]').forEach(btn => btn.classList.toggle('active', btn.dataset.bg === state.background));
  }

  function goToPage(index) {
    if (index < 0 || index >= state.pages.length || index === state.pageIndex) return;
    state.pageIndex = index; state.active = null; state.selectedId = null; state.dragging = null;
    syncPageAppearance(); updateUI(); draw();
    showToast(`Page ${state.pageIndex + 1} of ${state.pages.length}`);
  }

  function addPage() {
    state.pages.push({ items: [], redo: [], background: state.background });
    state.pageIndex = state.pages.length - 1; state.active = null; state.selectedId = null; state.dragging = null;
    syncPageAppearance(); updateUI(); draw();
    showToast(`Page ${state.pageIndex + 1} added`);
  }

  $('previousPageBtn').onclick = () => goToPage(state.pageIndex - 1);
  $('nextPageBtn').onclick = () => goToPage(state.pageIndex + 1);
  $('addPageBtn').onclick = addPage;

  $('importBtn').onclick=()=>$('imageInput').click();
  $('imageInput').onchange=(event)=>{
    const file=event.target.files[0]; if(!file)return;
    const reader=new FileReader(); reader.onload=()=>{
      const img=new Image(); img.onload=()=>{
        const maxW=canvas.clientWidth*.65,maxH=canvas.clientHeight*.65,scale=Math.min(maxW/img.width,maxH/img.height,1);
        const item={id:uid(),type:'image',src:reader.result,w:img.width*scale,h:img.height*scale};
        item.x=(canvas.clientWidth-item.w)/2; item.y=(canvas.clientHeight-item.h)/2;
        imageCache.set(item.id,img); commit(item); setTool('select'); state.selectedId=item.id; updateUI(); draw(); showToast('Image added — drag to move it');
      }; img.onerror=()=>showToast('Could not read that image'); img.src=reader.result;
    }; reader.readAsDataURL(file); event.target.value='';
  };

  $('exportBtn').onclick=(e)=>{ e.stopPropagation(); $('exportMenu').hidden=!$('exportMenu').hidden; };
  document.addEventListener('click',()=>$('exportMenu').hidden=true);
  $('exportMenu').addEventListener('click',async(event)=>{
    const button=event.target.closest('[data-export]'); if(!button)return;
    state.selectedId=null; draw(); $('exportMenu').hidden=true;
    const dataUrl=canvas.toDataURL('image/png');
    try {
      const pageDataUrls = state.pages.map(page => renderPageDataUrl(page));
      const result=button.dataset.export==='png' ? await window.whiteboardAPI.savePNG(dataUrl) : await window.whiteboardAPI.savePDF({dataUrls:pageDataUrls,width:canvas.clientWidth,height:canvas.clientHeight});
      if(!result.canceled) showToast(`${button.dataset.export.toUpperCase()} exported successfully`);
    } catch(error) { console.error(error); showToast('Export failed. Please try again.'); }
  });

  function renderPageDataUrl(page) {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
    const exportContext = exportCanvas.getContext('2d');
    const w = canvas.width / state.dpr, h = canvas.height / state.dpr;
    exportContext.setTransform(state.dpr,0,0,state.dpr,0,0);
    exportContext.fillStyle = page.background; exportContext.fillRect(0,0,w,h);
    const layer = document.createElement('canvas'); layer.width = canvas.width; layer.height = canvas.height;
    const layerContext = layer.getContext('2d'); layerContext.setTransform(state.dpr,0,0,state.dpr,0,0);
    page.items.forEach(item => drawItem(layerContext,item));
    exportContext.drawImage(layer,0,0,w,h);
    return exportCanvas.toDataURL('image/png');
  }

  function showToast(message){ const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
  window.addEventListener('keydown',(event)=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();return;}
    if((event.key==='Delete'||event.key==='Backspace')&&state.selectedId){event.preventDefault();deleteSelected();return;}
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='PageUp'){event.preventDefault();goToPage(state.pageIndex-1);return;}
    if(event.key==='PageDown'){event.preventDefault();goToPage(state.pageIndex+1);return;}
    const map={v:'select',p:'pen',b:'brush',e:'eraser',l:'line',r:'rectangle',c:'circle',t:'triangle',a:'arrow'};
    if(map[event.key.toLowerCase()])setTool(map[event.key.toLowerCase()]);
  });

  new ResizeObserver(resizeCanvas).observe(card);
  setTool('select'); updateUI();
})();
