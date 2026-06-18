/**
 * @dotrino/tutorial
 *
 * UI compartida del ecosistema Dotrino para hacer TUTORIALES / onboarding
 * guiado. Un Web Component (custom element, Shadow DOM) reutilizable por
 * CUALQUIER app (Vue o vanilla) que muestra burbujas iguales a la de
 * donar/compartir (`<dotrino-support>`), pero apuntando a elementos reales
 * de la interfaz para explicar "qué es esto" y "cómo se usa".
 *
 * Cumple, por diseño, las condiciones del tutorial:
 *   1) Cada burbuja se muestra UNA SOLA VEZ (persistido en localStorage por id).
 *   2) Se muestra UNA burbuja A LA VEZ (un único paso activo).
 *   3) Orden preestablecido OPCIONAL (campo `order`; si no, el del array).
 *   4) La burbuja se ubica para NO salirse de la pantalla (flip + clamp al viewport).
 *   5) MULTIIDIOMA (es/en, con `lang="auto"` y textos por paso `{ es, en }`).
 *   6) Acepta INYECCIÓN DE ESTILOS (variables CSS `--cct-*`, `::part()` y un
 *      string `styles` que se concatena dentro del Shadow DOM).
 *
 * Filosofía Dotrino: autohosteado, Shadow DOM, sin JS de terceros ni
 * cookies, bilingüe es/en. No toca identidad/transporte/almacenamiento.
 *
 * --- Uso (factory, recomendado) -------------------------------------------
 *   import { createTutorial } from '@dotrino/tutorial'
 *   const tour = createTutorial({
 *     lang: 'auto',
 *     storageKey: 'miapp.tutorial',           // namespace de "visto una vez"
 *     steps: [
 *       { id: 'menu', target: '#burger',
 *         title: { es: 'El menú', en: 'The menu' },
 *         text:  { es: 'Aquí abres tus cosas.', en: 'Open your stuff here.' },
 *         placement: 'bottom' },
 *       { id: 'crear', target: '[data-testid=new]',
 *         text: 'Crea algo nuevo aquí.',
 *         before: () => openDrawer() },           // prepara el estado para que el target sea visible
 *     ],
 *   })
 *   // tour.start() / tour.skip() / tour.reset()
 *
 * --- Uso (tag + propiedades) ----------------------------------------------
 *   import '@dotrino/tutorial'
 *   <dotrino-tutorial lang="es"></dotrino-tutorial>
 *   const el = document.querySelector('dotrino-tutorial')
 *   el.steps = [...]; el.start()
 *
 * --- Vanilla (jsDelivr) ----------------------------------------------------
 *   <script type="module"
 *     src="https://cdn.jsdelivr.net/npm/@dotrino/tutorial@0.1/src/index.js"></script>
 *
 * Eventos (bubbles, composed):
 *   cc-tutorial-start, cc-tutorial-step {detail:{id,index}}, cc-tutorial-advance
 *   {detail:{id}}, cc-tutorial-skip, cc-tutorial-done.
 */

// Etiquetas de los botones (es base/fallback). Los textos de cada paso se pasan
// por `steps` y pueden ser string o { es, en } (ver _resolveText).
const I18N = {
  es: { next: 'Siguiente', done: 'Entendido', skip: 'Saltar', step: '{n}/{total}', close: 'Cerrar' },
  en: { next: 'Next', done: 'Got it', skip: 'Skip', step: '{n}/{total}', close: 'Close' },
}

// Alias cómodos para `theme` -> variable CSS real. Cualquier clave que empiece
// por `--` se aplica tal cual.
const THEME_ALIASES = {
  accent: '--cct-bg', background: '--cct-bg', bg: '--cct-bg',
  text: '--cct-text', color: '--cct-text',
  radius: '--cct-radius', shadow: '--cct-shadow', font: '--cct-font',
  maxWidth: '--cct-max-width', maxwidth: '--cct-max-width',
  z: '--cct-z', zIndex: '--cct-z', zindex: '--cct-z',
  ring: '--cct-ring-color', ringGlow: '--cct-ring-glow', overlay: '--cct-overlay',
  arrow: '--cct-arrow-size', gap: '--cct-gap',
}

const STYLE = `
  :host {
    /* Tokens temables (var pública --cct-* con su valor por defecto). Por
       defecto la burbuja es AZUL como la de donar/compartir (#3498db). */
    --_bg: var(--cct-bg, #3498db);
    --_text: var(--cct-text, #ffffff);
    --_radius: var(--cct-radius, 10px);
    --_shadow: var(--cct-shadow, 0 3px 12px rgba(0, 0, 0, 0.35));
    --_font: var(--cct-font, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif);
    --_arrow: var(--cct-arrow-size, 7px);
    --_maxw: var(--cct-max-width, 280px);
    --_z: var(--cct-z, 2147483600);
    --_gap: var(--cct-gap, 12px);
    --_ring: var(--cct-ring-color, rgba(52, 152, 219, 0.95));
    --_glow: var(--cct-ring-glow, rgba(52, 152, 219, 0.30));
    --_overlay: var(--cct-overlay, rgba(0, 0, 0, 0.45));

    position: fixed;
    inset: 0;
    z-index: var(--_z);
    pointer-events: none; /* el host no captura: los clics pasan a la app */
    font-family: var(--_font);
  }
  * { box-sizing: border-box; }
  .cct-root { position: absolute; inset: 0; pointer-events: none; }

  /* Fondo opcional (atributo overlay): atrapa clics fuera de la burbuja. El
     oscurecido lo pinta el aro (.ring.dim) con su box-shadow gigante. */
  .backdrop { position: fixed; inset: 0; pointer-events: auto; background: transparent; }

  /* Aro de resaltado alrededor del elemento objetivo. */
  .ring {
    position: fixed;
    pointer-events: none;
    border-radius: 8px;
    box-shadow: 0 0 0 2px var(--_ring), 0 0 0 5px var(--_glow);
    animation: cct-pulse 1.8s ease-in-out infinite;
    transition: left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease;
  }
  .ring.dim {
    /* Oscurece TODO menos el recorte del aro, y sin animación de pulso. */
    box-shadow: 0 0 0 2px var(--_ring), 0 0 0 9999px var(--_overlay);
    animation: none;
  }
  @keyframes cct-pulse {
    0%, 100% { box-shadow: 0 0 0 2px var(--_ring), 0 0 0 3px transparent; }
    50%      { box-shadow: 0 0 0 2px var(--_ring), 0 0 0 8px var(--_glow); }
  }

  /* La burbuja: misma estética que la de donar/compartir. */
  .bubble {
    position: fixed;
    top: 0;
    left: 0;
    pointer-events: auto;
    max-width: var(--_maxw);
    background: var(--_bg);
    color: var(--_text);
    padding: 0.6rem 0.85rem 0.65rem;
    border-radius: var(--_radius);
    font-size: 0.85rem;
    line-height: 1.35;
    font-weight: 500;
    box-shadow: var(--_shadow);
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
    transition: opacity 0.25s ease, transform 0.25s ease;
    cursor: default;
  }
  .bubble.show { opacity: 1; transform: none; }

  .title { font-weight: 700; font-size: 0.92rem; margin: 0 0 0.25rem; padding-right: 1rem; }
  .body { margin: 0; }
  .body a { color: inherit; text-decoration: underline; }

  .foot {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.6rem; margin-top: 0.6rem;
  }
  .count { font-size: 0.72rem; opacity: 0.85; font-weight: 600; white-space: nowrap; }
  .btns { display: inline-flex; align-items: center; gap: 0.45rem; }
  .skip {
    background: none; border: none; color: inherit; opacity: 0.78;
    font: inherit; font-size: 0.75rem; cursor: pointer; text-decoration: underline;
    padding: 0.15rem 0.25rem;
  }
  .skip:hover { opacity: 1; }
  .next {
    background: rgba(255, 255, 255, 0.18); border: 1px solid rgba(255, 255, 255, 0.35);
    color: inherit; font: inherit; font-weight: 700; font-size: 0.78rem;
    padding: 0.32rem 0.75rem; border-radius: 50px; cursor: pointer;
    transition: background 0.2s ease;
  }
  .next:hover { background: rgba(255, 255, 255, 0.30); }
  .close {
    position: absolute; top: 0.2rem; right: 0.3rem; width: 1.35rem; height: 1.35rem;
    border: none; background: none; color: inherit; opacity: 0.7;
    font-size: 1.1rem; line-height: 1; cursor: pointer; border-radius: 50%;
  }
  .close:hover { opacity: 1; background: rgba(255, 255, 255, 0.18); }

  /* Cursor (triángulo CSS) que apunta al objetivo; su color sigue al fondo. */
  .arrow { position: absolute; width: 0; height: 0; border: var(--_arrow) solid transparent; }
  .arrow.up { border-top: 0; border-bottom-color: var(--_bg); top: calc(-1 * var(--_arrow)); }
  .arrow.down { border-bottom: 0; border-top-color: var(--_bg); bottom: calc(-1 * var(--_arrow)); }
  .arrow.left { border-left: 0; border-right-color: var(--_bg); left: calc(-1 * var(--_arrow)); }
  .arrow.right { border-right: 0; border-left-color: var(--_bg); right: calc(-1 * var(--_arrow)); }

  @media (prefers-reduced-motion: reduce) {
    .ring { animation: none; }
    .bubble { transition: opacity 0.15s ease; transform: none; }
  }
  @media (max-width: 480px) {
    .bubble { font-size: 0.82rem; max-width: min(var(--_maxw), calc(100vw - 24px)); }
  }
`

function escHtml (s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escAttr (s) {
  return escHtml(s).replace(/"/g, '&quot;')
}
function fmt (tpl, n, total) {
  return String(tpl).replace('{n}', n).replace('{total}', total)
}
function now () {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()
}
function clamp (v, lo, hi) {
  if (hi < lo) return lo
  return Math.max(lo, Math.min(hi, v))
}

class DotrinoTutorial extends HTMLElement {
  static get observedAttributes () {
    return ['lang', 'storage-key', 'overlay', 'no-highlight', 'step-timeout', 'no-count', 'no-skip']
  }

  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    this._steps = []
    this._i18n = null
    this._theme = null
    this._extraCss = ''
    this._memSeen = new Set()       // fallback si localStorage no está disponible
    this._running = false
    this._runId = 0                 // generación: invalida loops async en vuelo
    this._index = -1
    this._queue = []
    this._active = null             // { step, target }
    this._cancelWait = null
    this._raf = 0
    this._invisibleSince = 0
    this._rootEl = null
    this._styleEl = null
    this._reposition = () => { this._fit(); this._place() }
    this._onKeydown = this._onKeydown.bind(this)
  }

  connectedCallback () {
    this._ensureBaseDom()
    if (this.hasAttribute('autostart')) this.start()
  }

  disconnectedCallback () {
    this._teardownListeners()
    if (this._cancelWait) this._cancelWait()
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = 0
  }

  attributeChangedCallback (name) {
    if (!this._rootEl) return
    if (name === 'lang' || name === 'storage-key' || name === 'overlay' || name === 'no-highlight' || name === 'no-count' || name === 'no-skip') {
      if (this._active) this._renderBubble()
    }
  }

  /* ---------------- propiedades (para frameworks/JS) ---------------- */
  set steps (v) { this._steps = Array.isArray(v) ? v.slice() : [] }
  get steps () { return this._steps }
  /** Override de etiquetas de botones: { es:{next,done,skip,...}, en:{...} } o plano {next,...}. */
  set i18n (v) { this._i18n = v || null; if (this._active) this._renderBubble() }
  get i18n () { return this._i18n }
  /** Objeto de tema: claves CSS (--cct-... / --ccs-...) o alias (accent, text, radius, ...). */
  set theme (v) { this._theme = v || null; this._applyTheme() }
  get theme () { return this._theme }
  /** CSS arbitrario que se concatena DESPUÉS del estilo propio (gana por cascada). */
  set styles (v) { this._extraCss = v == null ? '' : String(v); this._renderStyle() }
  get styles () { return this._extraCss }

  /* ---------------- idioma (mismo patrón que support) ---------------- */
  get _lang () {
    const attr = (this.getAttribute('lang') || 'auto').toLowerCase()
    if (attr === 'es' || attr === 'en') return attr
    const doc = (typeof document !== 'undefined' && document.documentElement.lang || '').toLowerCase()
    const nav = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase()
    return (doc || nav).startsWith('en') ? 'en' : 'es'
  }

  get _t () {
    const base = I18N[this._lang]
    const o = this._i18n
    if (!o) return base
    const perLang = (o[this._lang] && typeof o[this._lang] === 'object') ? o[this._lang] : null
    const flat = (!o.es && !o.en && typeof o === 'object') ? o : null
    return { ...base, ...(flat || {}), ...(perLang || {}) }
  }

  _resolveText (v) {
    if (v == null) return ''
    if (typeof v === 'string') return v
    if (typeof v === 'object') {
      return v[this._lang] || v.es || v.en || Object.values(v)[0] || ''
    }
    return String(v)
  }

  /* ---------------- persistencia "visto una vez" ---------------- */
  get _storageKey () { return this.getAttribute('storage-key') || 'cc-tutorial' }
  _seenKey (id) { return `${this._storageKey}:seen:${id}` }

  isStepSeen (id) {
    if (this._memSeen.has(id)) return true
    try { return localStorage.getItem(this._seenKey(id)) === '1' } catch { return false }
  }

  markSeen (id) {
    if (!id) return
    this._memSeen.add(id)
    try { localStorage.setItem(this._seenKey(id), '1') } catch { /* sin storage */ }
  }

  /** Olvida un paso (o todos) para que vuelvan a mostrarse. */
  reset (id) {
    if (id) {
      this._memSeen.delete(id)
      try { localStorage.removeItem(this._seenKey(id)) } catch { /* */ }
      return
    }
    for (const s of this._steps) {
      if (!s || !s.id) continue
      this._memSeen.delete(s.id)
      try { localStorage.removeItem(this._seenKey(s.id)) } catch { /* */ }
    }
  }

  _orderedSteps () {
    return this._steps
      .map((s, i) => ({ s, i, k: Number.isFinite(s && s.order) ? s.order : i }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .map((x) => x.s)
      .filter((s) => s && s.id)
  }

  /* ---------------- ciclo de vida del tour ---------------- */
  async start (opts = {}) {
    this._ensureBaseDom()
    if (this._running) return
    this._running = true
    const run = ++this._runId
    this.dispatchEvent(new CustomEvent('cc-tutorial-start', { bubbles: true, composed: true }))
    const delay = Number(opts.delay != null ? opts.delay : (this.getAttribute('start-delay') || 0))
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    if (run !== this._runId || !this._running) return
    this._queue = this._orderedSteps()
    this._index = 0
    this._runNext()
  }

  /** Detiene el tour sin marcar nada (se puede volver a start()). */
  stop () {
    this._running = false
    this._runId++ // invalida cualquier _runNext/_waitForTarget en vuelo
    if (this._cancelWait) this._cancelWait()
    this._hideBubble()
    this._active = null
    this._teardownListeners()
  }

  /** Avanza al siguiente paso (marca el actual como visto). */
  next () { this._advance() }
  /** Termina el tutorial y marca como vistos los pasos restantes. */
  skip () { this._skipAll() }
  /** Quita el componente del DOM. */
  destroy () { this.stop(); this.remove() }

  async _runNext () {
    const run = this._runId
    if (!this._running) return
    while (this._index < this._queue.length) {
      if (run !== this._runId) return
      const step = this._queue[this._index]
      if (!step || !step.id) { this._index++; continue }
      if (this.isStepSeen(step.id)) { this._index++; continue }
      let skip = false
      try { skip = typeof step.skipIf === 'function' && !!(await step.skipIf()) } catch { skip = false }
      if (run !== this._runId || !this._running) return
      if (skip) { this._index++; continue }   // no aplica ahora: saltar SIN marcar visto
      try { if (typeof step.before === 'function') await step.before() } catch { /* el before es best-effort */ }
      if (run !== this._runId || !this._running) return
      const target = await this._waitForTarget(step)
      if (run !== this._runId || !this._running) return
      if (!target) { this._index++; continue } // el objetivo nunca apareció: saltar sin marcar
      this._show(step, target)
      return
    }
    this._finish()
  }

  _resolveTarget (step) {
    const t = step.target != null ? step.target : (step.anchor != null ? step.anchor : step.el)
    try {
      if (typeof t === 'function') return t() || null
      if (typeof t === 'string') {
        const els = document.querySelectorAll(t)
        for (const e of els) { if (this._isVisible(e)) return e }
        return els[0] || null
      }
      if (t instanceof Element) return t
    } catch { /* selector inválido, etc. */ }
    return null
  }

  _isVisible (el) {
    if (!el || !el.isConnected) return false
    if (!el.getClientRects || !el.getClientRects().length) return false
    const r = el.getBoundingClientRect()
    if (r.width <= 0 && r.height <= 0) return false
    let cs
    try { cs = getComputedStyle(el) } catch { return false }
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return false
    // Oclusión: el centro del objetivo no debe estar TAPADO por otro elemento
    // (header fijo, modal, overlay, cajón…). Si lo está, lo tratamos como NO
    // visible y el tutorial espera a que se descubra (o avanza tras la gracia).
    if (this.hasAttribute('no-occlusion-check')) return true
    const px = clamp(r.left + r.width / 2, 1, vw - 1)
    const py = clamp(r.top + r.height / 2, 1, vh - 1)
    let topEl = null
    try { topEl = document.elementFromPoint(px, py) } catch { topEl = null }
    // topEl === this → nuestra propia burbuja tapa el centro: no cuenta como oclusión.
    if (topEl && topEl !== this && topEl !== el && !el.contains(topEl) && !topEl.contains(el)) return false
    return true
  }

  /* Detecta barras FIJAS/STICKY pegadas arriba o abajo del viewport (headers,
     navbars, footers) para no colocar la burbuja debajo de ellas. Devuelve los
     insets superior e inferior en px. */
  _safeInsets () {
    if (this.hasAttribute('no-safe-area')) return { top: 0, bottom: 0 }
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    let top = 0
    let bottom = 0
    const sample = (x, y) => {
      let els
      try { els = document.elementsFromPoint(x, y) } catch { return }
      for (const e of els) {
        if (e === this || !(e instanceof Element)) continue
        let pos
        try { pos = getComputedStyle(e).position } catch { continue }
        if (pos !== 'fixed' && pos !== 'sticky') continue
        const r = e.getBoundingClientRect()
        if (r.width < vw * 0.5 || r.height > vh * 0.4) continue // debe ser una barra ancha y no enorme
        if (r.top <= 2 && r.bottom > top) top = r.bottom
        else if (r.bottom >= vh - 2 && vh - r.top > bottom) bottom = vh - r.top
      }
    }
    sample(vw * 0.5, 2); sample(vw * 0.18, 2); sample(vw * 0.82, 2)
    sample(vw * 0.5, vh - 3); sample(vw * 0.18, vh - 3); sample(vw * 0.82, vh - 3)
    return { top, bottom }
  }

  _waitForTarget (step) {
    const timeout = Number.isFinite(step.timeout)
      ? step.timeout
      : (Number(this.getAttribute('step-timeout')) || 6000)
    return new Promise((resolve) => {
      const t0 = now()
      let done = false
      const finish = (val) => { if (done) return; done = true; cleanup(); resolve(val) }
      const tick = () => {
        if (!this._running) return finish(null)
        const el = this._resolveTarget(step)
        if (el && this._isVisible(el)) return finish(el)
        if (now() - t0 >= timeout) return finish(null)
      }
      const iv = setInterval(tick, 120)
      let mo = null
      try {
        mo = new MutationObserver(tick)
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
      } catch { /* sin MutationObserver */ }
      const cleanup = () => { clearInterval(iv); if (mo) mo.disconnect(); this._cancelWait = null }
      this._cancelWait = () => finish(null)
      tick()
    })
  }

  _show (step, target) {
    this._active = { step, target }
    this._invisibleSince = 0
    this._renderBubble()
    this._teardownListeners()
    window.addEventListener('resize', this._reposition, true)
    window.addEventListener('scroll', this._reposition, true)
    document.addEventListener('keydown', this._onKeydown, true)
    this.dispatchEvent(new CustomEvent('cc-tutorial-step', {
      detail: { id: step.id, index: this._index }, bubbles: true, composed: true,
    }))
  }

  _hasFurther () {
    for (let i = this._index + 1; i < this._queue.length; i++) {
      const s = this._queue[i]
      if (!s || !s.id || this.isStepSeen(s.id)) continue
      // Best-effort: si su skipIf es síncrono y ya devuelve truthy, ese paso no
      // se mostrará, así que no cuenta como "siguiente" (botón → "Entendido").
      try {
        if (typeof s.skipIf === 'function') {
          const r = s.skipIf()
          if (r && typeof r.then !== 'function') continue
        }
      } catch { /* ignora */ }
      return true
    }
    return false
  }

  _renderBubble () {
    const a = this._active
    const root = this._rootEl
    if (!root) return
    if (!a) { root.innerHTML = ''; return }
    const t = this._t
    const step = a.step
    const title = this._resolveText(step.title)
    const body = this._resolveText(step.text != null ? step.text : (step.body != null ? step.body : step.content))
    const allowHtml = !!(step.html || step.allowHtml)
    const further = this._hasFurther()
    const nextLabel = step.nextLabel || (further ? t.next : t.done)
    const showSkip = further && !this.hasAttribute('no-skip')
    const showCount = !this.hasAttribute('no-count') && this._queue.length > 1
    const overlay = this.hasAttribute('overlay')
    const ringOn = !this.hasAttribute('no-highlight')

    root.innerHTML = `
      ${overlay ? '<div class="backdrop" part="overlay"></div>' : ''}
      ${ringOn ? `<div class="ring${overlay ? ' dim' : ''}" part="ring"></div>` : ''}
      <div class="bubble" part="bubble" role="dialog" aria-live="polite" aria-label="${escAttr(title || body)}">
        <span class="arrow" part="arrow"></span>
        <button class="close" part="close" type="button" aria-label="${escAttr(t.close)}">&times;</button>
        ${title ? `<p class="title" part="title">${allowHtml ? title : escHtml(title)}</p>` : ''}
        <div class="body" part="body">${allowHtml ? body : escHtml(body)}</div>
        <div class="foot">
          <span class="count" part="count">${showCount ? escHtml(fmt(t.step, this._index + 1, this._queue.length)) : ''}</span>
          <span class="btns">
            ${showSkip ? `<button class="skip" part="skip" type="button">${escHtml(t.skip)}</button>` : ''}
            <button class="next" part="next" type="button">${escHtml(nextLabel)}</button>
          </span>
        </div>
      </div>`

    this._bubbleEl = root.querySelector('.bubble')
    this._arrowEl = root.querySelector('.arrow')
    this._ringEl = root.querySelector('.ring')
    this._backdropEl = root.querySelector('.backdrop')

    root.querySelector('.next').addEventListener('click', () => this._advance())
    root.querySelector('.close').addEventListener('click', () => this._advance())
    const sk = root.querySelector('.skip')
    if (sk) sk.addEventListener('click', () => this._skipAll())
    if (this._backdropEl && this.hasAttribute('overlay-dismiss')) {
      this._backdropEl.addEventListener('click', () => this._advance())
    }

    this._fit()
    this._place()
    requestAnimationFrame(() => {
      if (this._bubbleEl) this._bubbleEl.classList.add('show')
      this._fit()
      this._place()
    })
    this._startLoop()
  }

  _startLoop () {
    if (this._raf) return
    const loop = () => {
      if (!this._active) { this._raf = 0; return }
      const el = this._resolveTarget(this._active.step)
      if (el && this._isVisible(el)) {
        this._active.target = el
        this._invisibleSince = 0
        this._place()
      } else {
        // El objetivo desapareció / quedó fuera de pantalla (p. ej. el usuario
        // navegó o hizo scroll): tras una gracia corta avanzamos al siguiente,
        // SIN marcar este como visto (no se llegó a leer), para que pueda volver
        // a mostrarse cuando el objetivo reaparezca.
        if (!this._invisibleSince) this._invisibleSince = now()
        else if (now() - this._invisibleSince > 800) { this._advance(false); return }
      }
      this._raf = requestAnimationFrame(loop)
    }
    this._raf = requestAnimationFrame(loop)
  }

  /* Acota la burbuja al viewport para que nunca sea más grande que la pantalla
     (si no, el clamp no podría meterla). Si con texto muy largo excede el alto,
     hace scroll SOLO el cuerpo (.body): título y pie quedan fijos, así el botón
     Siguiente/Entendido siempre es alcanzable. No se llama por frame (solo al
     mostrar y al redimensionar), porque mide el layout. */
  _fit () {
    const bubble = this._bubbleEl
    if (!bubble) return
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight
    const margin = parseFloat(getComputedStyle(this).getPropertyValue('--cct-margin')) || 10
    const ins = this._safeInsets()
    this._insets = ins // cache: lo reusa _place por frame sin re-escanear el DOM
    const capW = Math.max(80, vw - 2 * margin)
    const capH = Math.max(80, vh - 2 * margin - ins.top - ins.bottom)
    const cssMaxW = parseFloat(getComputedStyle(bubble).maxWidth)
    bubble.style.maxWidth = (Number.isFinite(cssMaxW) ? Math.min(cssMaxW, capW) : capW) + 'px'
    const body = bubble.querySelector('.body')
    if (!body) {
      bubble.style.maxHeight = capH + 'px'
      bubble.style.overflowY = 'auto'
      return
    }
    body.style.maxHeight = 'none'
    body.style.overflowY = 'visible'
    const nonBody = bubble.offsetHeight - body.offsetHeight // título + pie + paddings
    if (bubble.offsetHeight > capH) {
      body.style.maxHeight = Math.max(40, capH - nonBody) + 'px'
      body.style.overflowY = 'auto'
    }
  }

  /* Posiciona la burbuja junto al objetivo: prueba el placement preferido y, si
     no entra, lo voltea; al final hace clamp para no salirse de la pantalla. */
  _place () {
    const a = this._active
    const bubble = this._bubbleEl
    if (!a || !bubble) return
    const target = a.target
    if (!target || !target.getBoundingClientRect) return
    const tr = target.getBoundingClientRect()
    const vw = window.innerWidth || document.documentElement.clientWidth
    const vh = window.innerHeight || document.documentElement.clientHeight

    const cs = getComputedStyle(this)
    const margin = parseFloat(cs.getPropertyValue('--cct-margin')) || 10
    const gap = parseFloat(cs.getPropertyValue('--cct-gap')) || 12
    const arrowSize = parseFloat(cs.getPropertyValue('--cct-arrow-size')) || 7
    // Insets de barras fijas/sticky (header/footer): la burbuja no debe meterse
    // debajo del navbar. Amplían el margen superior/inferior. Usamos el valor
    // cacheado por _fit (estable durante el paso) para no re-escanear por frame.
    const ins = this._insets || this._safeInsets()
    const mTop = margin + ins.top
    const mBot = margin + ins.bottom

    const bw = bubble.offsetWidth
    const bh = bubble.offsetHeight
    const cx = tr.left + tr.width / 2
    const cy = tr.top + tr.height / 2

    const computePos = (p) => {
      if (p === 'bottom') return { left: cx - bw / 2, top: tr.bottom + gap }
      if (p === 'top') return { left: cx - bw / 2, top: tr.top - gap - bh }
      if (p === 'right') return { left: tr.right + gap, top: cy - bh / 2 }
      /* left */ return { left: tr.left - gap - bw, top: cy - bh / 2 }
    }
    const fits = (pos) =>
      pos.left >= margin && pos.left + bw <= vw - margin &&
      pos.top >= mTop && pos.top + bh <= vh - mBot

    const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
    const pref = a.step.placement && opposite[a.step.placement] ? a.step.placement : 'bottom'
    const order = [pref, opposite[pref], ...['bottom', 'top', 'right', 'left'].filter((p) => p !== pref && p !== opposite[pref])]

    let chosen = null
    for (const p of order) {
      const pos = computePos(p)
      if (fits(pos)) { chosen = { p, ...pos }; break }
    }
    if (!chosen) {
      // Ningún lado entra (objetivo en una esquina/borde): elegimos el lado con
      // MÁS espacio libre (descontando el área de barras fijas), para que el
      // cursor apunte al objetivo tras el clamp.
      const space = { bottom: (vh - mBot) - tr.bottom, top: tr.top - mTop, right: vw - tr.right, left: tr.left }
      const p = Object.keys(space).sort((x, y) => space[y] - space[x])[0]
      chosen = { p, ...computePos(p) }
    }

    const left = clamp(chosen.left, margin, vw - bw - margin)
    const top = clamp(chosen.top, mTop, vh - bh - mBot)
    bubble.style.left = left + 'px'
    bubble.style.top = top + 'px'

    // El lado del cursor se deriva de la posición FINAL (tras el clamp), no del
    // placement teórico: así no apunta al vacío si el clamp movió la burbuja. Si
    // la burbuja queda solapada con el objetivo (sin un lado limpio), se oculta.
    const eps = 1
    let side = null
    if (top >= tr.bottom - eps) side = 'bottom'
    else if (top + bh <= tr.top + eps) side = 'top'
    else if (left >= tr.right - eps) side = 'right'
    else if (left + bw <= tr.left + eps) side = 'left'
    this._placeArrow(side, tr, left, top, bw, bh, arrowSize)

    const ring = this._ringEl
    if (ring) {
      const pad = parseFloat(cs.getPropertyValue('--cct-ring-pad')) || 6
      ring.style.left = (tr.left - pad) + 'px'
      ring.style.top = (tr.top - pad) + 'px'
      ring.style.width = (tr.width + pad * 2) + 'px'
      ring.style.height = (tr.height + pad * 2) + 'px'
    }
  }

  _placeArrow (placement, tr, left, top, bw, bh, size) {
    const arrow = this._arrowEl
    if (!arrow) return
    arrow.className = 'arrow'
    arrow.style.left = arrow.style.top = arrow.style.right = arrow.style.bottom = ''
    if (!placement) { arrow.style.display = 'none'; return } // solape: sin cursor
    arrow.style.display = ''
    const cx = tr.left + tr.width / 2
    const cy = tr.top + tr.height / 2
    const rad = 10 // margen para no pisar las esquinas redondeadas
    if (placement === 'bottom' || placement === 'top') {
      arrow.classList.add(placement === 'bottom' ? 'up' : 'down')
      const ax = clamp(cx - left - size, rad, bw - 2 * size - rad)
      arrow.style.left = ax + 'px'
    } else {
      arrow.classList.add(placement === 'right' ? 'left' : 'right')
      const ay = clamp(cy - top - size, rad, bh - 2 * size - rad)
      arrow.style.top = ay + 'px'
    }
  }

  _advance (mark = true) {
    const a = this._active
    if (mark && a && a.step && a.step.id) this.markSeen(a.step.id)
    this._hideBubble()
    this._active = null
    this._index++
    this.dispatchEvent(new CustomEvent('cc-tutorial-advance', {
      detail: { id: a && a.step ? a.step.id : null }, bubbles: true, composed: true,
    }))
    this._runNext()
  }

  _skipAll () {
    for (let i = this._index; i < this._queue.length; i++) {
      const s = this._queue[i]
      if (s && s.id) this.markSeen(s.id)
    }
    this.dispatchEvent(new CustomEvent('cc-tutorial-skip', { bubbles: true, composed: true }))
    this._finish()
  }

  _finish () {
    this._hideBubble()
    this._active = null
    this._running = false
    this._runId++
    this._teardownListeners()
    this.dispatchEvent(new CustomEvent('cc-tutorial-done', { bubbles: true, composed: true }))
  }

  _hideBubble () {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0 }
    if (this._rootEl) this._rootEl.innerHTML = ''
    this._bubbleEl = this._arrowEl = this._ringEl = this._backdropEl = null
  }

  _teardownListeners () {
    window.removeEventListener('resize', this._reposition, true)
    window.removeEventListener('scroll', this._reposition, true)
    document.removeEventListener('keydown', this._onKeydown, true)
  }

  _onKeydown (e) {
    if (e.key === 'Escape' && this._active) {
      if (this.hasAttribute('esc-skip')) this._skipAll()
      else this._advance()
    }
  }

  /* ---------------- DOM base / estilos / tema ---------------- */
  _ensureBaseDom () {
    if (this._rootEl) { this._renderStyle(); return }
    this._styleEl = document.createElement('style')
    this._rootEl = document.createElement('div')
    this._rootEl.className = 'cct-root'
    this.shadowRoot.append(this._styleEl, this._rootEl)
    this._renderStyle()
    this._applyTheme()
  }

  _renderStyle () {
    if (this._styleEl) {
      this._styleEl.textContent = STYLE + (this._extraCss ? '\n/* styles inyectados */\n' + this._extraCss : '')
    }
  }

  _applyTheme () {
    const t = this._theme
    if (!t) return
    for (const k of Object.keys(t)) {
      const v = t[k]
      if (v == null) continue
      if (k.startsWith('--')) this.style.setProperty(k, String(v))
      else if (THEME_ALIASES[k]) this.style.setProperty(THEME_ALIASES[k], String(v))
    }
  }
}

/**
 * Crea (o reutiliza) un `<dotrino-tutorial>` y arranca el tour.
 * Devuelve el elemento, que ES el controlador (start/stop/next/skip/reset/...).
 */
function createTutorial (options = {}) {
  if (typeof document === 'undefined') return null
  let el = options.element || options.el
  if (!el) {
    el = document.createElement('dotrino-tutorial')
    ;(options.mount || document.body).appendChild(el)
  }
  if (options.lang != null) el.setAttribute('lang', options.lang)
  if (options.storageKey != null) el.setAttribute('storage-key', options.storageKey)
  if (options.highlight === false) el.setAttribute('no-highlight', '')
  if (options.overlay) el.setAttribute('overlay', '')
  if (options.overlayDismiss) el.setAttribute('overlay-dismiss', '')
  if (options.escSkip) el.setAttribute('esc-skip', '')
  if (options.showCount === false) el.setAttribute('no-count', '')
  if (options.allowSkip === false) el.setAttribute('no-skip', '')
  if (options.stepTimeout != null) el.setAttribute('step-timeout', String(options.stepTimeout))
  if (options.i18n) el.i18n = options.i18n
  if (options.theme) el.theme = options.theme
  if (options.styles != null) el.styles = options.styles
  el.steps = options.steps || []
  if (options.autostart !== false) el.start({ delay: options.startDelay })
  return el
}

if (typeof customElements !== 'undefined' && !customElements.get('dotrino-tutorial')) {
  customElements.define('dotrino-tutorial', DotrinoTutorial)
}

export { DotrinoTutorial, createTutorial }
export default createTutorial
