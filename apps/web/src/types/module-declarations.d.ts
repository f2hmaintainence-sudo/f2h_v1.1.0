// ============================================================================
// COMPREHENSIVE TYPE DECLARATIONS FOR ALL THIRD-PARTY MODULES
// Fixes all TypeScript errors for modules without built-in type definitions
// ============================================================================

// ============================================================================
// 1. PURECOUNTER - Number Counter Library
// ============================================================================
declare module '@srexi/purecounterjs' {
  class PureCounter {
    constructor(options?: {
      start?: number;
      end?: number;
      duration?: number;
      delay?: number;
      once?: boolean;
      repeat?: boolean;
      decimals?: number;
      legacy?: boolean;
      filesizing?: boolean;
      prefix?: string;
      suffix?: string;
    });
  }
  export default PureCounter;
}

// ============================================================================
// 2. SELECT2 - jQuery-based Select Plugin
// ============================================================================
declare module 'select2' {
  function select2(jquery: any): void;
  export default select2;
}

// ============================================================================
// 3. TAGIFY - Smart Tag Input
// ============================================================================
declare module '@yaireo/tagify' {
  class Tagify {
    constructor(element: HTMLElement, settings?: any);
    destroy(): void;
    addTags(tags: string | string[] | any[]): void;
    removeAllTags(): void;
    getTags(withTerm?: boolean): any[];
    getCleanValue(): any[];
    getInputValue(): string;
    setInputValue(value: string): void;
    loading(isLoading: boolean): void;
    setData(newData: any[], keepOrder?: boolean): void;
    clear(): void;
    removeTag(tagElm: HTMLElement, silent?: boolean): void;
    parseMixTags(str: string): string;
    on(eventName: string, callback: (...args: any[]) => void): void;
    off(eventName: string, callback?: (...args: any[]) => void): void;
    DOM: {
      scope: HTMLElement;
      input: HTMLElement;
      tagList: HTMLElement;
    };
    settings: any;
    state: any;
    [key: string]: any;
  }
  export default Tagify;
}

// ============================================================================
// 4. SORTABLE.JS - Reorderable Drag-and-Drop Lists
// ============================================================================
declare module 'sortablejs' {
  class Sortable {
    constructor(element: HTMLElement, options?: any);
    destroy(): void;
    option(key: string, value?: any): any;
    toArray(): string[];
    sort(order: string[]): void;
    save(): string[];
    static create(element: HTMLElement, options?: any): Sortable;
    static mount(...plugins: any[]): void;
    static Swap: any;
    static MultiDrag: any;
    static Animate: any;
    [key: string]: any;
  }
  export default Sortable;
}

// ============================================================================
// 5. INTERACT.JS - Drag, Resize and Gesture Support
// ============================================================================
declare module 'interactjs' {
  function interact(target: string | HTMLElement | SVGElement | Document | Window): any;
  namespace interact {
    function isSet(target: any): boolean;
    function on(type: string, listener: (...args: any[]) => void): any;
    function off(type: string, listener: (...args: any[]) => void): any;
    function dynamicDrop(value: boolean): any;
    const pointerMoveTolerance: number;
  }
  export default interact;
}

// ============================================================================
// 6. CLEAVE.JS - Input Masking
// ============================================================================
declare module 'cleave.js' {
  class Cleave {
    constructor(element: HTMLElement | string, options?: any);
    destroy(): void;
    getFormattedValue(): string;
    getRawValue(): string;
    setValue(value: string): void;
    setRawValue(value: string): void;
    [key: string]: any;
  }
  export default Cleave;
}

// ============================================================================
// 7. CANVAS-CONFETTI - Confetti Effect
// ============================================================================
declare module 'canvas-confetti' {
  function confetti(options?: {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    ticks?: number;
    angle?: number;
    origin?: { x?: number; y?: number };
    position?: 'fixed' | 'absolute' | 'relative';
    colors?: string[];
    shapes?: ('square' | 'circle' | string)[];
    scalar?: number;
    zIndex?: number;
    disableForReducedMotion?: boolean;
    [key: string]: any;
  }): Promise<void>;
  
  namespace confetti {
    interface ConfettiOptions {
      particleCount?: number;
      spread?: number;
      startVelocity?: number;
      decay?: number;
      gravity?: number;
      ticks?: number;
      angle?: number;
      origin?: { x?: number; y?: number };
      colors?: string[];
      shapes?: ('square' | 'circle' | string)[];
      scalar?: number;
      [key: string]: any;
    }
    function reset(): void;
    function create(...args: any[]): any;
  }
  
  export default confetti;
}

// ============================================================================
// 8. QUILL - Rich Text Editor
// ============================================================================
declare module 'quill' {
  class Quill {
    constructor(container: string | HTMLElement, options?: any);
    root: HTMLElement;
    container: HTMLElement;
    
    // Content Methods
    setContents(delta: any, source?: string): any;
    updateContents(change: any, source?: string): any;
    getContents(index?: number, length?: number): any;
    getLength(): number;
    getText(index?: number, length?: number): string;
    getHTML(): string;
    
    // Selection Methods
    getSelection(focus?: boolean): any;
    setSelection(index: number, length?: number, source?: string): void;
    focus(): void;
    blur(): void;
    
    // Formatting
    format(name: string, value: any, source?: string): any;
    removeFormat(index: number, length: number, source?: string): any;
    formatText(index: number, length: number, format: string, value: any, source?: string): any;
    formatLine(index: number, length: number, format: string, value: any, source?: string): any;
    getFormat(index: number, length?: number): any;
    
    // Text Operations
    insertText(index: number, text: string, formats?: any, source?: string): any;
    deleteText(index: number, length: number, source?: string): any;
    insertEmbed(index: number, type: string, value: any, formats?: any, source?: string): any;
    
    // State
    enable(enabled?: boolean): void;
    disable(): void;
    isEnabled(): boolean;
    
    // Events
    on(name: string, callback: (...args: any[]) => void): Quill;
    once(name: string, callback: (...args: any[]) => void): Quill;
    off(name: string, callback?: (...args: any[]) => void): Quill;
    
    [key: string]: any;
  }
  
  namespace Quill {
    const BaseTheme: any;
    const themes: any;
  }
  
  export default Quill;
}

// ============================================================================
// 9. AOS - Animate On Scroll Library
// ============================================================================
declare module 'aos' {
  namespace AOS {
    function init(options?: {
      offset?: number;
      delay?: number;
      duration?: number;
      easing?: string;
      once?: boolean;
      mirror?: boolean;
      anchorPlacement?: string;
      [key: string]: any;
    }): void;
    function refresh(): void;
    function refreshHard(): void;
    function remove(): void;
    function getAll(): any[];
  }
  export default AOS;
}

// ============================================================================
// 10. DROPZONE - File Upload
// ============================================================================
declare module 'dropzone' {
  class Dropzone {
    constructor(container: string | HTMLElement, options?: any);
    
    // File Management
    destroy(): void;
    processQueue(): void;
    processFile(file: any): void;
    processFiles(files: File[]): void;
    addFile(file: File): void;
    removeFile(file: any): void;
    removeAllFiles(cancelIfNecessary?: boolean): void;
    resizeImage(file: any, maxWidth: number, maxHeight: number, resizeMethod: string, callback: Function): void;
    
    // File Lists
    getAcceptedFiles(): any[];
    getRejectedFiles(): any[];
    getQueuedFiles(): any[];
    getUploadingFiles(): any[];
    getAddedFiles(): any[];
    getCurrentUpload(): any;
    cancel(): void;
    
    // Events
    on(eventName: string, callback: (...args: any[]) => void): Dropzone;
    off(eventName: string, callback?: (...args: any[]) => void): Dropzone;
    emit(eventName: string, ...args: any[]): void;
    
    // Configuration
    options?: any;
    files: any[];
    [key: string]: any;
    
    static autoDiscover: boolean;
    static instances: Dropzone[];
    static forElement(element: HTMLElement): Dropzone | undefined;
    static confirm(message: string, accepted: Function, rejected?: Function): void;
    static isBrowserSupported(): boolean;
  }
  export default Dropzone;
}

// ============================================================================
// 11. CROPPIE - Advanced Image Cropper
// ============================================================================
declare module 'croppie' {
  class Croppie {
    constructor(element: HTMLElement, options?: any);
    
    result(options?: {
      type?: 'canvas' | 'blob' | 'base64' | 'rawcanvas';
      size?: 'viewport' | 'original';
      format?: string;
      quality?: number;
      multiplier?: number;
      circle?: boolean;
    }): Promise<any>;
    
    zip(options?: any): Promise<any>;
    crop(): HTMLCanvasElement;
    rotate(angle: number): void;
    setZoom(value: number): void;
    setCustomRatio(ratio: number): void;
    setAspectRatio(ratio: number): void;
    destroy(): void;
    bind(options: {
      url?: string;
      points?: number[];
      zoom?: number;
      orientation?: number;
    }): Promise<void>;
    get(): any;
    setImage(source: string | HTMLImageElement): Promise<void>;
    getImageData(): any;
    
    [key: string]: any;
  }
  export default Croppie;
}

// ============================================================================
// 12. SWEETALERT2 - Beautiful Alert Library
// ============================================================================
declare module 'sweetalert2' {
  class Swal {
    static fire(options?: any): Promise<any>;
    static fire(title?: string, message?: string, icon?: string): Promise<any>;
    static close(): void;
    static show(): void;
    static hide(): void;
    static enable(): void;
    static disable(): void;
    static enableButtons(): void;
    static disableButtons(): void;
    static showLoading(): void;
    static hideLoading(): void;
    static getContainer(): HTMLElement | null;
    static getPopup(): HTMLElement | null;
    static getTitle(): HTMLElement | null;
    static getContent(): HTMLElement | null;
    static getImage(): HTMLElement | null;
    static getIcon(): HTMLElement | null;
    static getConfirmButton(): HTMLButtonElement | null;
    static getCancelButton(): HTMLButtonElement | null;
    static isVisible(): boolean;
    static isLoading(): boolean;
    static mixin(options: any): any;
    static default: any;
    static [key: string]: any;
  }
  export default Swal;
}

// ============================================================================
// 13. DATATABLES.NET - Data Table Plugin
// ============================================================================
declare module 'datatables.net' {
  const DataTable: any;
  export default DataTable;
}

// ============================================================================
// 14. DATATABLES.NET-BS5 - Bootstrap 5 DataTables Integration
// ============================================================================
declare module 'datatables.net-bs5' {
  const dataTableBs5: any;
  export default dataTableBs5;
}

// ============================================================================
// GLOBAL WINDOW INTERFACE EXTENSIONS
// ============================================================================

declare global {
  interface Window {
    // jQuery & DOM
    $: any;
    jQuery: any;
    
    // HTTP & API
    axios: any;
    
    // UI Framework
    bootstrap: any;
    Popper: any;
    
    // UI Libraries & Components
    Swal: any;
    Quill: any;
    Cleave: any;
    Tagify: any;
    Sortable: any;
    interact: any;
    AOS: any;
    Dropzone: any;
    Croppie: any;
    confetti: any;
    cssToast: any;
    
    // Date & Time
    moment: any;
    
    // Custom Application
    general: any;
    
    // Custom Properties
    __DEVICE_ID__: string;
    isSecureContext: boolean;
  }

  // Navigation & Page Events
  interface Document {
    readyState: 'loading' | 'interactive' | 'complete';
  }
}

// ============================================================================
// EXPORT EMPTY OBJECT TO MAKE THIS A MODULE
// ============================================================================

export {};
