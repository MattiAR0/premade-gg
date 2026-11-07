import { LEGAL } from '../../legal/legal-info';

/** Base de las páginas legales: datos del titular para las plantillas */
export abstract class LegalPage {
  readonly legal = LEGAL;
  readonly mailto = `mailto:${LEGAL.contactEmail}`;
}
