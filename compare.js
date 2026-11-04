// PKP Studio before/after viewer.
// <figure class="compare" data-before="photo.jpg" data-after='{"Oil":"oil.jpg","Watercolour":"wc.jpg"}' data-caption="..."></figure>
// data-after may also be a single image path. Drag the gold handle; click "Full view" for a zoomable full-screen view.
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function build(host, opts) {
    const styles = typeof opts.after === 'string' ? {Painted: opts.after} : opts.after;
    const names = Object.keys(styles);
    host.innerHTML = `
      <div class="cmp-stage" tabindex="0" role="slider" aria-label="Drag to compare photo and painting" aria-valuemin="0" aria-valuemax="100">
        <div class="cmp-zoom">
          <img class="cmp-after" alt="painted" draggable="false">
          <div class="cmp-clip"><img class="cmp-before" alt="original photo" draggable="false"></div>
        </div>
        <div class="cmp-line"><span class="cmp-knob">⟷</span></div>
        <span class="cmp-tag cmp-tag-l">${opts.beforeLabel || 'Photo'}</span><span class="cmp-tag cmp-tag-r"></span>
      </div>
      <div class="cmp-bar">
        <div class="cmp-styles">${names.length > 1 ? names.map((n, i) => `<button type="button" data-s="${n}" class="${i ? '' : 'on'}">${n}</button>`).join('') : ''}</div>
        ${opts.full ? '<span class="cmp-hint">scroll or pinch to zoom · drag to look around</span>' : '<button type="button" class="cmp-full">⤢ Full view</button>'}
      </div>`;
    const stage = host.querySelector('.cmp-stage'), zoomEl = host.querySelector('.cmp-zoom'),
      clip = host.querySelector('.cmp-clip'), line = host.querySelector('.cmp-line'),
      after = host.querySelector('.cmp-after'), before = host.querySelector('.cmp-before'), tagR = host.querySelector('.cmp-tag-r');
    let pos = 50, cur = names[0], z = 1, px = 0, py = 0;

    before.src = opts.before;
    const setStyle = n => { cur = n; after.src = styles[n]; tagR.textContent = n; host.querySelectorAll('.cmp-styles button').forEach(b => b.classList.toggle('on', b.dataset.s === n)); };
    setStyle(cur);
    after.onload = () => {
      stage.style.aspectRatio = `${after.naturalWidth} / ${after.naturalHeight}`;
      host.style.setProperty('--ar', after.naturalWidth / after.naturalHeight);  // full view fits the screen height
    };

    const draw = () => {
      // the clip lives inside the zoomed layer: convert the handle's screen position into layer space
      const w = stage.clientWidth || 1, layerPos = clamp(((pos / 100) * w - px) / z / w * 100, 0, 100);
      clip.style.clipPath = `inset(0 ${100 - layerPos}% 0 0)`;
      line.style.left = pos + '%';
      stage.setAttribute('aria-valuenow', Math.round(pos));
      zoomEl.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
    };
    draw();

    // the handle follows the pointer; when zoomed, dragging away from the handle pans the picture
    let mode = null, sx = 0, sy = 0, spx = 0, spy = 0;
    const toPos = e => { const r = stage.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width * 100, 0, 100); };
    stage.addEventListener('pointerdown', e => {
      const r = stage.getBoundingClientRect(), handleX = r.left + r.width * pos / 100;
      mode = z > 1.01 && Math.abs(e.clientX - handleX) > 28 ? 'pan' : 'slide';
      sx = e.clientX; sy = e.clientY; spx = px; spy = py;
      stage.setPointerCapture(e.pointerId);
      if (mode === 'slide') { pos = toPos(e); draw(); }
    });
    stage.addEventListener('pointermove', e => {
      if (!mode) return;
      if (mode === 'slide') pos = toPos(e);
      else { const r = stage.getBoundingClientRect(); px = clamp(spx + e.clientX - sx, -r.width * (z - 1), 0); py = clamp(spy + e.clientY - sy, -r.height * (z - 1), 0); }
      draw();
    });
    stage.addEventListener('pointerup', () => mode = null);
    stage.addEventListener('pointercancel', () => mode = null);
    stage.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { pos = clamp(pos + (e.key === 'ArrowLeft' ? -4 : 4), 0, 100); draw(); e.preventDefault(); }
    });
    if (opts.full) {  // zoom only in full view, so the page itself still scrolls normally
      stage.addEventListener('wheel', e => {
        e.preventDefault();
        const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
        const nz = clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 6);
        px = clamp(mx - (mx - px) * nz / z, -r.width * (nz - 1), 0); py = clamp(my - (my - py) * nz / z, -r.height * (nz - 1), 0);
        z = nz; draw();
      }, {passive: false});
      let pinch = null;
      stage.addEventListener('touchmove', e => {
        if (e.touches.length !== 2) return;
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (pinch) { z = clamp(z * d / pinch, 1, 6); const r = stage.getBoundingClientRect(); px = clamp(px, -r.width * (z - 1), 0); py = clamp(py, -r.height * (z - 1), 0); draw(); }
        pinch = d;
      }, {passive: false});
      stage.addEventListener('touchend', () => pinch = null);
    }
    host.querySelectorAll('.cmp-styles button').forEach(b => b.onclick = () => setStyle(b.dataset.s));
    const fullBtn = host.querySelector('.cmp-full');
    if (fullBtn) fullBtn.onclick = () => openFull(opts, cur, pos);
    return {setStyle, setPos: p => { pos = p; draw(); }};
  }

  function openFull(opts, style, pos) {
    const box = document.createElement('div');
    box.className = 'cmp-modal';
    box.innerHTML = `<button class="cmp-close" aria-label="Close">✕</button><figure class="compare cmp-big"></figure>${opts.caption ? `<p class="cmp-cap">${opts.caption}</p>` : ''}`;
    document.body.append(box); document.body.style.overflow = 'hidden';
    const v = build(box.querySelector('figure'), {...opts, full: true});
    v.setStyle(style); v.setPos(pos);
    const close = () => { box.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); };
    const esc = e => e.key === 'Escape' && close();
    box.querySelector('.cmp-close').onclick = close;
    box.addEventListener('click', e => { if (e.target === box) close(); });
    document.addEventListener('keydown', esc);
  }

  document.querySelectorAll('figure.compare[data-before]').forEach(f => {
    let after = f.dataset.after;
    try { after = JSON.parse(after); } catch (e) { /* plain path */ }
    build(f, {before: f.dataset.before, beforeLabel: f.dataset.beforeLabel, after, caption: f.dataset.caption || ''});
  });
})();
