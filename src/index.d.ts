/** Texto multiidioma: un string fijo o un mapa por idioma (es/en + extras). */
export type CcLocalizedText = string | { es?: string; en?: string; [lang: string]: string | undefined }

/** Objetivo de un paso: selector CSS, Element, o función que lo resuelve. */
export type CcTutorialTarget = string | Element | (() => Element | null | undefined)

/** Un paso del tutorial: una burbuja anclada a un elemento de la interfaz. */
export interface CcTutorialStep {
  /** Identificador único y estable. Se usa para el "visto una sola vez". */
  id: string
  /** Elemento al que se ancla la burbuja. */
  target?: CcTutorialTarget
  /** Alias de `target`. */
  anchor?: CcTutorialTarget
  /** Alias de `target`. */
  el?: CcTutorialTarget
  /** Título (negrita) opcional. */
  title?: CcLocalizedText
  /** Cuerpo del mensaje. */
  text?: CcLocalizedText
  /** Alias de `text`. */
  body?: CcLocalizedText
  /** Alias de `text`. */
  content?: CcLocalizedText
  /** Lado preferido respecto al objetivo (se voltea si no entra). Default 'bottom'. */
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** Orden explícito (menor primero). Si se omite, vale el orden del array. */
  order?: number
  /** Si `text`/`title` traen HTML ya confiable (no se escapa). */
  html?: boolean
  /** Alias de `html`. */
  allowHtml?: boolean
  /** Etiqueta personalizada del botón de avanzar para este paso. */
  nextLabel?: string
  /** Tiempo máx (ms) a esperar a que el objetivo sea visible antes de saltarlo. */
  timeout?: number
  /** Prepara el estado de la app para que el objetivo sea visible (puede ser async). */
  before?: () => void | Promise<void>
  /** Si devuelve true, el paso se salta SIN marcarse como visto (puede ser async). */
  skipIf?: () => boolean | Promise<boolean>
}

/** Opciones de createTutorial(). */
export interface CcTutorialOptions {
  steps: CcTutorialStep[]
  /** Elemento existente a reutilizar (si no, se crea y se monta en `mount`/body). */
  element?: DotrinoTutorial
  el?: DotrinoTutorial
  /** Dónde montar el elemento creado (default document.body). */
  mount?: Element
  /** 'es' | 'en' | 'auto' (default 'auto'). */
  lang?: string
  /** Namespace de localStorage para el "visto una sola vez". */
  storageKey?: string
  /** Muestra un aro de resaltado sobre el objetivo (default true). */
  highlight?: boolean
  /** Oscurece el resto de la pantalla (spotlight). Default false. */
  overlay?: boolean
  /** Con overlay, clic fuera de la burbuja avanza. */
  overlayDismiss?: boolean
  /** Escape termina el tutorial (en vez de avanzar). */
  escSkip?: boolean
  /** Muestra el contador "n/total" (default true). */
  showCount?: boolean
  /** Muestra el enlace "Saltar" (default true). */
  allowSkip?: boolean
  /** Tiempo máx (ms) por paso esperando a que el objetivo aparezca. */
  stepTimeout?: number
  /** Retraso (ms) antes de mostrar el primer paso. */
  startDelay?: number
  /** Arranca solo al crear (default true). */
  autostart?: boolean
  /** Override de etiquetas de botones: { es:{...}, en:{...} } o plano {next,done,skip,...}. */
  i18n?: Record<string, any>
  /** Tema: claves CSS (--cct-*) o alias (accent, text, radius, shadow, font, maxWidth, z, ring, overlay). */
  theme?: Record<string, string | number>
  /** CSS arbitrario inyectado dentro del Shadow DOM (gana por cascada). */
  styles?: string
}

export declare class DotrinoTutorial extends HTMLElement {
  steps: CcTutorialStep[]
  i18n: Record<string, any> | null
  theme: Record<string, string | number> | null
  styles: string
  /** Arranca el tour (salta los pasos ya vistos). */
  start (opts?: { delay?: number }): Promise<void>
  /** Detiene el tour sin marcar nada. */
  stop (): void
  /** Avanza al siguiente paso (marca el actual como visto). */
  next (): void
  /** Termina el tutorial y marca como vistos los pasos restantes. */
  skip (): void
  /** ¿Ese paso ya se mostró alguna vez? */
  isStepSeen (id: string): boolean
  /** Marca un paso como visto. */
  markSeen (id: string): void
  /** Olvida un paso (o todos, sin argumento) para que vuelvan a mostrarse. */
  reset (id?: string): void
  /** Quita el componente del DOM. */
  destroy (): void
}

export declare function createTutorial (options: CcTutorialOptions): DotrinoTutorial

export default createTutorial

declare global {
  interface HTMLElementTagNameMap { 'dotrino-tutorial': DotrinoTutorial }
  interface HTMLElementEventMap {
    'cc-tutorial-start': CustomEvent
    'cc-tutorial-step': CustomEvent<{ id: string; index: number }>
    'cc-tutorial-advance': CustomEvent<{ id: string | null }>
    'cc-tutorial-skip': CustomEvent
    'cc-tutorial-done': CustomEvent
  }
}
