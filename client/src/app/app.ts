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
      if (lastPath && path !== lastPath) window.scrollTo({ top: 0, behavior: 'instant' });
      lastPath = path;
    });
  }

  /** El <base href> haría que "#contenido" navegase a la home: movemos el foco a mano */
  skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('contenido')?.focus();
  }
}
