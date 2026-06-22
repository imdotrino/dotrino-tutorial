# @dotrino/tutorial

> **Parte del ecosistema [Dotrino](https://dotrino.com).** Misión: aplicaciones que resuelven problemas comunes, respetando tu privacidad — sin anuncios, sin cookies, sin rastreo de datos, sin vender tu identidad a nadie.

UI compartida del ecosistema **Dotrino** para hacer **tutoriales / onboarding
guiado**. Un Web Component (`<dotrino-tutorial>`, Shadow DOM) reutilizable
por cualquier app (Vue o vanilla): muestra **burbujas iguales a la de
donar/compartir** (`<dotrino-support>`), pero ancladas a elementos reales de
la interfaz para explicar *qué es esto* y *cómo se usa*.

Autohosteado, sin JS de terceros ni cookies, bilingüe **es/en**. No toca
identidad/transporte/almacenamiento. La misma librería para todas las apps.

## Qué garantiza (por diseño)

1. **Una sola vez** — cada burbuja se muestra una única vez (persistido en
   `localStorage` por `id`). Reabrir la app no la repite.
2. **Una a la vez** — solo hay un paso activo; nunca dos burbujas juntas.
3. **Orden preestablecido opcional** — `order` por paso; si se omite, vale el
   orden del array.
4. **No se sale de pantalla** — la burbuja prueba el lado preferido, lo voltea si
   no entra y al final hace *clamp* al viewport.
5. **Multiidioma** — `lang="es" | "en" | "auto"`; textos por paso `{ es, en }`.
6. **Inyección de estilos** — variables CSS `--cct-*`, `::part()` y un string
   `styles` que se concatena dentro del Shadow DOM.

## Instalación

```bash
npm i @dotrino/tutorial
```

Vanilla (sin build), por jsDelivr (pinea `major.minor`, nunca `@latest`):

```html
<script type="module"
  src="https://cdn.jsdelivr.net/npm/@dotrino/tutorial@0.1/src/index.js"></script>
```

## Uso (factory, recomendado)

```js
import { createTutorial } from '@dotrino/tutorial'

const tour = createTutorial({
  lang: 'auto',
  storageKey: 'miapp.tutorial',          // namespace del "visto una sola vez"
  steps: [
    {
      id: 'menu',
      target: '#burger',
      title: { es: 'El menú', en: 'The menu' },
      text:  { es: 'Aquí abres tus cosas.', en: 'Open your stuff here.' },
      placement: 'bottom',
    },
    {
      id: 'crear',
      target: '[data-testid="new"]',
      text: { es: 'Crea algo nuevo aquí.', en: 'Create something new here.' },
      // prepara el estado para que el target sea visible antes de mostrarse:
      before: () => openDrawer(),
    },
    {
      id: 'compartir',
      target: '[data-testid="share"]',
      text: { es: 'Y así lo compartes.', en: "And that's how you share it." },
    },
  ],
})

// API del controlador (el elemento devuelto):
// tour.start()  tour.stop()  tour.next()  tour.skip()
// tour.reset()  tour.reset('crear')  tour.isStepSeen('menu')  tour.destroy()
```

`createTutorial()` arranca solo (`autostart: true` por defecto). Devuelve el
`<dotrino-tutorial>`, que **es** el controlador.

## Uso (tag + propiedades)

```js
import '@dotrino/tutorial'
```

```html
<dotrino-tutorial lang="es" storage-key="miapp.tutorial"></dotrino-tutorial>
```

```js
const el = document.querySelector('dotrino-tutorial')
el.steps = [ /* ... */ ]
el.start()
```

> En Vue el tag funciona tal cual (es un custom element, **no** un componente
> Vue). Se maneja por propiedades/atributos/eventos del DOM.

## Paso (`CcTutorialStep`)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Único y estable. Clave del "visto una sola vez". **Obligatorio.** |
| `target` | `string \| Element \| () => Element` | Elemento a anclar (alias: `anchor`, `el`). |
| `title` | `string \| {es,en}` | Título en negrita (opcional). |
| `text` | `string \| {es,en}` | Cuerpo (alias: `body`, `content`). |
| `placement` | `'top'\|'bottom'\|'left'\|'right'` | Lado preferido (default `bottom`; se voltea si no entra). |
| `order` | `number` | Orden explícito (menor primero). |
| `before` | `() => void \| Promise` | Prepara el estado para que el target sea visible (abrir un cajón, cambiar de sección…). |
| `skipIf` | `() => boolean \| Promise` | Si devuelve `true`, el paso se salta **sin** marcarse como visto (p. ej. solo móvil). |
| `timeout` | `number` | Máx ms a esperar a que el target aparezca antes de saltarlo. |
| `html` | `boolean` | El texto trae HTML confiable (no se escapa). |
| `nextLabel` | `string` | Etiqueta personalizada del botón avanzar. |

**Cómo elige qué mostrar:** recorre los pasos en orden; salta los ya vistos y los
de `skipIf`; ejecuta `before()`; espera a que el `target` sea **visible** (si no
aparece en `timeout`, lo salta sin marcarlo, para reintentarlo en otra sesión);
muestra la burbuja. Al pulsar *Siguiente* marca el paso como visto y continúa.
*Saltar* marca como vistos todos los restantes (no vuelve a aparecer).

## Multiidioma

- `lang="es" | "en" | "auto"`. Con `auto` se infiere de `<html lang>` y luego de
  `navigator.language` (fallback `es`).
- El texto de cada paso puede ser un `string` o `{ es, en }`.
- Las etiquetas de botones se pueden sobreescribir con `i18n`:

```js
createTutorial({
  i18n: { es: { next: 'Vale', skip: 'Cerrar', done: 'Listo' } },
  steps: [/* ... */],
})
```

## Inyección de estilos

Tres mecanismos, combinables:

### 1) Variables CSS (`--cct-*`)

Ponlas en el host (o en `:root`) o pásalas por `theme`. Valores por defecto:

| Variable | Default | Qué controla |
|---|---|---|
| `--cct-bg` | `#3498db` | Fondo de la burbuja **y** color del cursor. |
| `--cct-text` | `#ffffff` | Color del texto. |
| `--cct-radius` | `10px` | Radio de la burbuja. |
| `--cct-shadow` | `0 3px 12px rgba(0,0,0,.35)` | Sombra. |
| `--cct-font` | `'Segoe UI', …` | Tipografía. |
| `--cct-max-width` | `280px` | Ancho máximo. |
| `--cct-arrow-size` | `7px` | Tamaño del cursor. |
| `--cct-gap` | `12px` | Separación burbuja↔objetivo. |
| `--cct-margin` | `10px` | Margen mínimo al borde del viewport. |
| `--cct-z` | `2147483600` | z-index del host. |
| `--cct-ring-color` | `rgba(52,152,219,.95)` | Color del aro de resaltado. |
| `--cct-ring-glow` | `rgba(52,152,219,.30)` | Halo del aro. |
| `--cct-ring-pad` | `6px` | Holgura del aro alrededor del objetivo. |
| `--cct-overlay` | `rgba(0,0,0,.45)` | Oscurecido con `overlay`. |

```js
createTutorial({
  theme: { accent: '#cda350', text: '#1c1c1e', radius: '14px' }, // alias cómodos
  // o claves crudas: { '--cct-bg': '#cda350', '--cct-radius': '14px' }
  steps: [/* ... */],
})
```

Alias aceptados en `theme`: `accent`/`bg`/`background`, `text`/`color`, `radius`,
`shadow`, `font`, `maxWidth`, `z`/`zIndex`, `ring`, `ringGlow`, `overlay`,
`arrow`, `gap`. Cualquier clave que empiece por `--` se aplica tal cual.

### 2) `::part()`

Partes expuestas: `bubble`, `arrow`, `title`, `body`, `count`, `next`, `skip`,
`close`, `ring`, `overlay`.

```css
dotrino-tutorial::part(next) { background: #fff; color: #111; }
dotrino-tutorial::part(bubble) { font-weight: 600; }
```

### 3) String `styles`

CSS arbitrario que se concatena **después** del estilo propio (gana por cascada):

```js
createTutorial({
  styles: `.bubble { letter-spacing: .2px } .title { text-transform: uppercase }`,
  steps: [/* ... */],
})
```

## Opciones de presentación

| Opción | Default | Efecto |
|---|---|---|
| `highlight` | `true` | Aro de resaltado sobre el objetivo. `false` para apagarlo. |
| `overlay` | `false` | Oscurece el resto (spotlight) y bloquea clics fuera. |
| `overlayDismiss` | `false` | Con `overlay`, clic fuera avanza. |
| `escSkip` | `false` | `Escape` termina el tutorial (si no, solo avanza el paso). |
| `showCount` | `true` | Muestra el contador "n/total". |
| `allowSkip` | `true` | Muestra el enlace "Saltar". |
| `startDelay` | `0` | Retraso (ms) antes del primer paso. |
| `stepTimeout` | `6000` | Máx ms por paso esperando a que el objetivo aparezca. |

## Eventos

`cc-tutorial-start`, `cc-tutorial-step` (`detail:{id,index}`),
`cc-tutorial-advance` (`detail:{id}`), `cc-tutorial-skip`, `cc-tutorial-done`.
Todos `bubbles` + `composed`.

## Filosofía

Parte del ecosistema [Dotrino](https://dotrino.com): *tu información, en tu
servidor, bajo tus reglas*. Este componente no envía datos a ningún lado; solo
guarda en `localStorage` qué burbujas ya viste para no repetirlas.

MIT · seyacat
