export const environment = {
  production: true,
  /** Origine + baseHref, sans slash final. Sert aux URLs canoniques / OpenGraph. */
  baseUrl: 'https://zikaoinfo.github.io/plan-ma-ville',
  /** Features communautaires (avis/auth). Vide = désactivé. Injecté en CI. */
  supabaseUrl: '',
  supabaseAnonKey: '',
  /** Cloudflare Worker (résumé IA, quiz). Vide = features IA désactivées. */
  workerUrl: '',
};
