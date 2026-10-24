import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, OnDestroy, Output } from '@angular/core';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento accesible para modales: mueve el foco dentro al abrir,
 * lo mantiene dentro con Tab, cierra con Esc y lo devuelve al cerrar.
 * Uso: <div class="c-modal" role="dialog" aria-modal="true" appDialog (dismiss)="cerrar()">
 */
@Directive({
  selector: '[appDialog]',
  standalone: true,
})
export class DialogDirective implements AfterViewInit, OnDestroy {
  @Output() dismiss = new EventEmitter<void>();

  private readonly previousFocus = document.activeElement as HTMLElement | null;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;
    if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');
    (this.focusables()[0] ?? host).focus();
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus?.();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.dismiss.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const items = this.focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusables(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null,
    );
  }
}
