import { DefaultUrlSerializer, type UrlTree } from '@angular/router';
import { avecSlashFinal, sansSlashFinal } from './slash-final';

/**
 * Sérialiseur d'URL du site : le routeur **accepte** les deux formes et
 * **produit** toujours celle avec slash final.
 *
 * Bug corrigé (cause n°1 de la désindexation) : `DefaultUrlSerializer.parse`
 * transforme `/ville/lyon-69123/` en TROIS segments `['ville','lyon-69123','']`
 * (le slash final crée un segment vide). La route `ville/:slug` n'en attend que
 * deux → aucune route ne matche → le wildcard `**` rend la page « Commune
 * introuvable », qui pose `<meta name="robots" content="noindex">`.
 *
 * Or c'est EXACTEMENT l'URL que Google demande : il suit le sitemap sur
 * `/ville/lyon-69123`, GitHub Pages le redirige (301) vers `/ville/lyon-69123/`,
 * y sert le bon HTML prérendu… que l'app détruisait ensuite à l'hydratation en
 * la remplaçant par un 404 + noindex. Googlebot exécutant le JS, il voyait le
 * noindex et retirait la page de l'index — d'où les pages « Exclue par balise
 * noindex » et la perte continue de pages indexées.
 *
 * `parse` normalise donc l'URL entrante (slash final retiré) avant le
 * découpage en segments ; `serialize` remet le slash final pour que les `href`
 * des `routerLink` et la barre d'adresse pointent vers l'URL réellement servie
 * en 200 (plus aucune redirection à crawler).
 */
export class SlashFinalUrlSerializer extends DefaultUrlSerializer {
  override parse(url: string): UrlTree {
    return super.parse(sansSlashFinal(url));
  }

  override serialize(tree: UrlTree): string {
    return avecSlashFinal(super.serialize(tree));
  }
}
