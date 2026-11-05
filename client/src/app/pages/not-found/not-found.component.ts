import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

/**
 * Página para rutas que no existen. Antes `**` redirigía a la home, y un enlace roto mostraba
 * la portada como si fuera la página pedida. Lleva `noindex` para que los buscadores que
 * ejecutan JS no la indexen (Vercel sigue respondiendo 200: sin SSR no hay 404 HTTP real).
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent implements OnInit, OnDestroy {
  private readonly meta = inject(Meta);

  ngOnInit(): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, follow' });
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
  }
}
