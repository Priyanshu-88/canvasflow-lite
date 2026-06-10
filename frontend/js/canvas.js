/**
 * canvas.js — Drawing Engine
 * 
 * Handles all Canvas API rendering: pen, highlighter, eraser, shapes,
 * arrows, text tool, laser pointer, zoom/pan, and PNG export.
 */

const CanvasEngine = (() => {
  const canvasEl = document.getElementById('drawing-canvas');
  const ctx = canvasEl.getContext('2d');
  const canvasArea = document.getElementById('canvas-area');

  let currentPoints = [];
  let strokes = [];
  let remoteCursors = {};
  let previewShape = null;
  let laserTrails = []; // Laser pointer trails that fade out

  function resize() {
    const rect = canvasArea.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasEl.width = rect.width * dpr;
    canvasEl.height = rect.height * dpr;
    canvasEl.style.width = rect.width + 'px';
    canvasEl.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }
  window.addEventListener('resize', resize);

  function getCanvasPoint(e) {
    const rect = canvasEl.getBoundingClientRect();
    const zoom = AppState.get('zoom');
    const panX = AppState.get('panX');
    const panY = AppState.get('panY');
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - panX) / zoom,
      y: (clientY - rect.top - panY) / zoom,
    };
  }

  function getBgColor() {
    return AppState.get('isDarkMode') ? '#0a0e1a' : '#f8fafc';
  }

  // ── Drawing Handlers ───────────────────────────────────
  function startDrawing(e) {
    e.preventDefault();
    const tool = AppState.get('currentTool');

    // Text tool: show text input overlay instead of drawing
    if (tool === 'text') {
      showTextInput(e);
      return;
    }

    AppState.set('isDrawing', true);
    const point = getCanvasPoint(e);
    currentPoints = [point];
  }

  function draw(e) {
    if (!AppState.get('isDrawing')) return;
    e.preventDefault();

    const point = getCanvasPoint(e);
    const tool = AppState.get('currentTool');
    const zoom = AppState.get('zoom');
    const panX = AppState.get('panX');
    const panY = AppState.get('panY');
    currentPoints.push(point);

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter' || tool === 'laser') {
      // Draw live segment
      const color = tool === 'eraser' ? getBgColor() : 
                    tool === 'laser' ? '#FF0000' :
                    AppState.get('currentColor');
      const size = tool === 'eraser' ? AppState.get('brushSize') * 4 : 
                   tool === 'highlighter' ? AppState.get('brushSize') * 2 :
                   AppState.get('brushSize');

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = size * zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
      }
      if (tool === 'laser') {
        ctx.globalAlpha = 0.8;
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 10;
      }

      if (currentPoints.length >= 3) {
        const p1 = currentPoints[currentPoints.length - 3];
        const p2 = currentPoints[currentPoints.length - 2];
        const p3 = currentPoints[currentPoints.length - 1];
        const midX = (p2.x + p3.x) / 2;
        const midY = (p2.y + p3.y) / 2;
        ctx.beginPath();
        ctx.moveTo(
          (p1.x + p2.x) / 2 * zoom + panX,
          (p1.y + p2.y) / 2 * zoom + panY
        );
        ctx.quadraticCurveTo(p2.x * zoom + panX, p2.y * zoom + panY, midX * zoom + panX, midY * zoom + panY);
        ctx.stroke();
      } else if (currentPoints.length === 2) {
        ctx.beginPath();
        ctx.moveTo(currentPoints[0].x * zoom + panX, currentPoints[0].y * zoom + panY);
        ctx.lineTo(currentPoints[1].x * zoom + panX, currentPoints[1].y * zoom + panY);
        ctx.stroke();
      }
      ctx.restore();

      if (typeof SocketClient !== 'undefined' && tool !== 'laser') {
        SocketClient.emitDrawLive({ point, color, size, tool });
      }
    } else {
      // Shape tools: preview
      previewShape = {
        tool, start: currentPoints[0], end: point,
        color: AppState.get('currentColor'), size: AppState.get('brushSize'),
      };
      render();
    }
  }

  function stopDrawing(e) {
    if (!AppState.get('isDrawing')) return;
    AppState.set('isDrawing', false);

    if (currentPoints.length < 2) { currentPoints = []; previewShape = null; return; }

    const tool = AppState.get('currentTool');

    // Laser doesn't persist — it fades out
    if (tool === 'laser') {
      laserTrails.push({ points: [...currentPoints], opacity: 1, time: Date.now() });
      currentPoints = [];
      startLaserFade();
      return;
    }

    const strokeData = {
      tool,
      points: currentPoints,
      color: tool === 'eraser' ? getBgColor() : AppState.get('currentColor'),
      size: tool === 'eraser' ? AppState.get('brushSize') * 4 :
            tool === 'highlighter' ? AppState.get('brushSize') * 2 :
            AppState.get('brushSize'),
    };

    strokes.push(strokeData);
    if (typeof SocketClient !== 'undefined') SocketClient.emitDraw(strokeData);
    currentPoints = [];
    previewShape = null;
    render();
  }

  // ── Laser Fade Animation ──────────────────────────────
  let laserFading = false;
  function startLaserFade() {
    if (laserFading) return;
    laserFading = true;
    function fadeStep() {
      const now = Date.now();
      laserTrails = laserTrails.filter(t => now - t.time < 1500);
      laserTrails.forEach(t => { t.opacity = Math.max(0, 1 - (now - t.time) / 1500); });
      render();
      if (laserTrails.length > 0) {
        requestAnimationFrame(fadeStep);
      } else {
        laserFading = false;
      }
    }
    requestAnimationFrame(fadeStep);
  }

  // ── Text Tool ──────────────────────────────────────────
  function showTextInput(e) {
    const overlay = document.getElementById('text-input-overlay');
    const rect = canvasArea.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    overlay.style.display = 'block';
    overlay.style.left = (clientX - rect.left) + 'px';
    overlay.style.top = (clientY - rect.top) + 'px';
    overlay.value = '';
    overlay.focus();

    const point = getCanvasPoint(e);

    function commitText() {
      const text = overlay.value.trim();
      overlay.style.display = 'none';
      overlay.removeEventListener('blur', commitText);
      overlay.removeEventListener('keydown', handleKey);
      if (!text) return;

      const strokeData = {
        tool: 'text',
        points: [point],
        color: AppState.get('currentColor'),
        size: AppState.get('brushSize') * 5 + 10,
        text: text,
      };
      strokes.push(strokeData);
      if (typeof SocketClient !== 'undefined') SocketClient.emitDraw(strokeData);
      render();
    }

    function handleKey(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commitText(); }
      if (ev.key === 'Escape') { overlay.style.display = 'none'; overlay.removeEventListener('blur', commitText); overlay.removeEventListener('keydown', handleKey); }
    }

    overlay.addEventListener('blur', commitText);
    overlay.addEventListener('keydown', handleKey);
  }

  // ── Render Engine ──────────────────────────────────────
  function render() {
    const rect = canvasArea.getBoundingClientRect();
    const zoom = AppState.get('zoom');
    const panX = AppState.get('panX');
    const panY = AppState.get('panY');

    ctx.clearRect(0, 0, rect.width, rect.height);
    drawGrid(rect.width, rect.height, zoom, panX, panY);
    strokes.forEach(stroke => drawStroke(stroke, zoom, panX, panY));

    // Laser trails
    laserTrails.forEach(trail => {
      if (trail.points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3 * zoom;
      ctx.lineCap = 'round';
      ctx.globalAlpha = trail.opacity;
      ctx.shadowColor = '#FF0000';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(trail.points[0].x * zoom + panX, trail.points[0].y * zoom + panY);
      for (let i = 1; i < trail.points.length; i++) {
        ctx.lineTo(trail.points[i].x * zoom + panX, trail.points[i].y * zoom + panY);
      }
      ctx.stroke();
      ctx.restore();
    });

    if (previewShape) drawShapePreview(previewShape, zoom, panX, panY);
    renderRemoteCursors();
  }

  function drawGrid(w, h, zoom, panX, panY) {
    const gridSize = 30 * zoom;
    const offsetX = (panX % gridSize + gridSize) % gridSize;
    const offsetY = (panY % gridSize + gridSize) % gridSize;
    ctx.strokeStyle = AppState.get('isDarkMode') ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < w; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = offsetY; y < h; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }

  function drawStroke(stroke, zoom, panX, panY) {
    const { tool, points, color, size, text } = stroke;
    if (!points || points.length < 1) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * zoom;
    ctx.strokeStyle = color;

    if (tool === 'highlighter') { ctx.globalAlpha = 0.3; }

    if (tool === 'text') {
      ctx.font = `${size * zoom}px Inter, sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = 1;
      const lines = (text || '').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, points[0].x * zoom + panX, points[0].y * zoom + panY + i * size * zoom * 1.2);
      });
      ctx.restore();
      return;
    }

    if (points.length < 2) { ctx.restore(); return; }

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      ctx.beginPath();
      ctx.moveTo(points[0].x * zoom + panX, points[0].y * zoom + panY);
      for (let i = 1; i < points.length - 1; i++) {
        const midX = (points[i].x + points[i+1].x) / 2;
        const midY = (points[i].y + points[i+1].y) / 2;
        ctx.quadraticCurveTo(points[i].x * zoom + panX, points[i].y * zoom + panY, midX * zoom + panX, midY * zoom + panY);
      }
      ctx.lineTo(points[points.length-1].x * zoom + panX, points[points.length-1].y * zoom + panY);
      ctx.stroke();
    } else if (tool === 'line') {
      const s = points[0], e = points[points.length-1];
      ctx.beginPath();
      ctx.moveTo(s.x * zoom + panX, s.y * zoom + panY);
      ctx.lineTo(e.x * zoom + panX, e.y * zoom + panY);
      ctx.stroke();
    } else if (tool === 'arrow') {
      const s = points[0], e = points[points.length-1];
      const sx = s.x * zoom + panX, sy = s.y * zoom + panY;
      const ex = e.x * zoom + panX, ey = e.y * zoom + panY;
      // Line
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(ey - sy, ex - sx);
      const headLen = 15 * zoom;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI/6), ey - headLen * Math.sin(angle - Math.PI/6));
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI/6), ey - headLen * Math.sin(angle + Math.PI/6));
      ctx.stroke();
    } else if (tool === 'rect') {
      const s = points[0], e = points[points.length-1];
      ctx.beginPath();
      ctx.rect(
        Math.min(s.x, e.x) * zoom + panX, Math.min(s.y, e.y) * zoom + panY,
        Math.abs(e.x - s.x) * zoom, Math.abs(e.y - s.y) * zoom
      );
      ctx.stroke();
    } else if (tool === 'circle') {
      const s = points[0], e = points[points.length-1];
      ctx.beginPath();
      ctx.ellipse(
        ((s.x + e.x) / 2) * zoom + panX, ((s.y + e.y) / 2) * zoom + panY,
        Math.abs(e.x - s.x) / 2 * zoom, Math.abs(e.y - s.y) / 2 * zoom, 0, 0, Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShapePreview(shape, zoom, panX, panY) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawStroke({ tool: shape.tool, points: [shape.start, shape.end], color: shape.color, size: shape.size }, zoom, panX, panY);
    ctx.restore();
  }

  // ── Remote Cursors ─────────────────────────────────────
  function updateRemoteCursor(data) {
    remoteCursors[data.userId] = data;
    renderRemoteCursors();
  }

  function removeRemoteCursor(userId) {
    delete remoteCursors[userId];
    const el = document.getElementById(`cursor-${userId}`);
    if (el) el.remove();
  }

  function renderRemoteCursors() {
    const zoom = AppState.get('zoom');
    const panX = AppState.get('panX');
    const panY = AppState.get('panY');
    Object.values(remoteCursors).forEach(cursor => {
      let el = document.getElementById(`cursor-${cursor.userId}`);
      if (!el) {
        el = document.createElement('div');
        el.id = `cursor-${cursor.userId}`;
        el.className = 'remote-cursor';
        el.innerHTML = `<div class="cursor-pointer" style="background:${cursor.color}"></div><div class="cursor-label" style="background:${cursor.color}">${cursor.username}</div>`;
        canvasArea.appendChild(el);
      }
      el.style.left = (cursor.x * zoom + panX) + 'px';
      el.style.top = (cursor.y * zoom + panY) + 'px';
    });
  }

  function addRemoteStroke(strokeData) { strokes.push(strokeData); render(); }
  function setStrokes(newStrokes) { strokes = newStrokes.map(s => s.stroke_data || s); render(); }
  function clearStrokes() { strokes = []; render(); }

  function setZoom(newZoom) {
    const clamped = Math.max(0.25, Math.min(3, newZoom));
    AppState.set('zoom', clamped);
    document.getElementById('zoom-label').textContent = Math.round(clamped * 100) + '%';
    render();
  }

  function resetView() {
    AppState.update({ zoom: 1, panX: 0, panY: 0 });
    document.getElementById('zoom-label').textContent = '100%';
    render();
  }

  // Wheel zoom
  canvasArea.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(AppState.get('zoom') + (e.deltaY > 0 ? -0.1 : 0.1));
  }, { passive: false });

  // Middle mouse pan
  let isPanning = false, panStart = { x: 0, y: 0 };
  canvasArea.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      isPanning = true;
      panStart = { x: e.clientX - AppState.get('panX'), y: e.clientY - AppState.get('panY') };
      canvasEl.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (isPanning) {
      AppState.update({ panX: e.clientX - panStart.x, panY: e.clientY - panStart.y });
      render();
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 1 && isPanning) { isPanning = false; canvasEl.style.cursor = 'crosshair'; }
  });

  // Canvas events
  canvasEl.addEventListener('mousedown', (e) => { if (e.button === 0) startDrawing(e); });
  canvasEl.addEventListener('mousemove', (e) => {
    draw(e);
    if (typeof SocketClient !== 'undefined') {
      const pt = getCanvasPoint(e);
      SocketClient.emitCursor(pt.x, pt.y);
    }
  });
  canvasEl.addEventListener('mouseup', stopDrawing);
  canvasEl.addEventListener('mouseleave', stopDrawing);
  canvasEl.addEventListener('touchstart', startDrawing, { passive: false });
  canvasEl.addEventListener('touchmove', draw, { passive: false });
  canvasEl.addEventListener('touchend', stopDrawing);

  // ── Export PNG ──────────────────────────────────────────
  function exportPNG() {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    const rect = canvasArea.getBoundingClientRect();
    tempCanvas.width = rect.width * 2;
    tempCanvas.height = rect.height * 2;
    tempCtx.scale(2, 2);
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, rect.width, rect.height);

    strokes.forEach(stroke => {
      const { tool, points, color, size, text } = stroke;
      if (!points || points.length < 1 || color === getBgColor()) return;
      tempCtx.lineCap = 'round';
      tempCtx.lineJoin = 'round';
      tempCtx.lineWidth = size;
      tempCtx.strokeStyle = color === getBgColor() ? '#ffffff' : color;
      tempCtx.fillStyle = color;
      tempCtx.globalAlpha = tool === 'highlighter' ? 0.3 : 1;

      if (tool === 'text') {
        tempCtx.font = `${size}px Inter, sans-serif`;
        (text || '').split('\n').forEach((line, i) => {
          tempCtx.fillText(line, points[0].x, points[0].y + i * size * 1.2);
        });
      } else if (tool === 'pen' || tool === 'highlighter') {
        if (points.length < 2) return;
        tempCtx.beginPath();
        tempCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length - 1; i++) {
          tempCtx.quadraticCurveTo(points[i].x, points[i].y, (points[i].x + points[i+1].x)/2, (points[i].y + points[i+1].y)/2);
        }
        tempCtx.lineTo(points[points.length-1].x, points[points.length-1].y);
        tempCtx.stroke();
      } else if (tool === 'line') {
        tempCtx.beginPath();
        tempCtx.moveTo(points[0].x, points[0].y);
        tempCtx.lineTo(points[points.length-1].x, points[points.length-1].y);
        tempCtx.stroke();
      } else if (tool === 'arrow') {
        const s = points[0], e = points[points.length-1];
        tempCtx.beginPath(); tempCtx.moveTo(s.x, s.y); tempCtx.lineTo(e.x, e.y); tempCtx.stroke();
        const angle = Math.atan2(e.y - s.y, e.x - s.x);
        tempCtx.beginPath(); tempCtx.moveTo(e.x, e.y);
        tempCtx.lineTo(e.x - 15*Math.cos(angle-Math.PI/6), e.y - 15*Math.sin(angle-Math.PI/6));
        tempCtx.moveTo(e.x, e.y);
        tempCtx.lineTo(e.x - 15*Math.cos(angle+Math.PI/6), e.y - 15*Math.sin(angle+Math.PI/6));
        tempCtx.stroke();
      } else if (tool === 'rect') {
        const s = points[0], e = points[points.length-1];
        tempCtx.beginPath();
        tempCtx.rect(Math.min(s.x,e.x), Math.min(s.y,e.y), Math.abs(e.x-s.x), Math.abs(e.y-s.y));
        tempCtx.stroke();
      } else if (tool === 'circle') {
        const s = points[0], e = points[points.length-1];
        tempCtx.beginPath();
        tempCtx.ellipse((s.x+e.x)/2, (s.y+e.y)/2, Math.abs(e.x-s.x)/2, Math.abs(e.y-s.y)/2, 0, 0, Math.PI*2);
        tempCtx.stroke();
      }
      tempCtx.globalAlpha = 1;
    });

    const link = document.createElement('a');
    link.download = `canvasflow-${AppState.get('roomId')}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  }

  function init() { resize(); }

  return {
    init, render, resize, setStrokes, clearStrokes, addRemoteStroke,
    updateRemoteCursor, removeRemoteCursor, setZoom, resetView, exportPNG,
    getStrokes: () => strokes,
  };
})();
