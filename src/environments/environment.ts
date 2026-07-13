export const environment = {
  production: true,
  /** Origine + baseHref, sans slash final. Sert aux URLs canoniques / OpenGraph. */
  baseUrl: 'https://planmaville.fr',
  /**
   * Features communautaires (avis/auth). Placeholders remplacés en CI par
   * les secrets GitHub (voir deploy.yml). Sans remplacement → features off.
   */
  supabaseUrl: '__SUPABASE_URL__',
  supabaseAnonKey: '__SUPABASE_ANON_KEY__',
  /** Cloudflare Worker (résumé IA, quiz IA). Vide/placeholder = features IA off. */
  workerUrl: '__WORKER_URL__',
};
