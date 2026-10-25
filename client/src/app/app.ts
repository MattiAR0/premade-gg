import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterOutlet, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /**
   * Una página nueva empieza arriba. Solo cuando cambia la ruta: los filtros cambian
   * los query params y no deben mover el scroll.
   */
  constructor(router: Router) {
    let lastPath = '';
    router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;
      const path = event.urlAfterRedirects.split(/[?#]/)[0];
      if (lastPath && path !== lastPath) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        // El foco no se queda en el enlace pulsado: teclado y lector de pantalla empiezan en la página nueva
        setTimeout(() => this.focusContent());
      }
      lastPath = path;
    });
  }

  /**
   * Foco al h1 de la página. Si aún no ha cargado (detalle, perfil), el foco espera al
   * inicio del contenido y pasa al h1 cuando aparece, salvo que el usuario ya lo haya movido.
   */
  private focusContent(): void {
    const start = document.getElementById('contenido');
    const focusHeading = (): boolean => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return false;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading() || !start) return;

    start.focus({ preventScroll: true });
    const observer = new MutationObserver(() => {
      if (document.activeElement !== start) return observer.disconnect();
      if (focusHeading()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  }

  /** El <base href> haría que "#contenido" navegase a la home: movemos el foco a mano */
  skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('contenido')?.focus();
  }
}
