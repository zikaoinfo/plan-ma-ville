/**
 * Calcul de contraste WCAG 2.1 (relative luminance) — utilisé par les tests
 * de design system, qui lisent les tokens RÉELLEMENT calculés dans la page.
 *
 * Pourquoi ne pas se fier aux commentaires de `styles.scss` : un ratio noté à
 * la main reste juste jusqu'au jour où la couleur bouge sans que le commentaire
 * suive. Ici la valeur testée est celle que le navigateur applique.
 */

/** Accepte `#rgb`, `#rrggbb` et `rgb(r g b / a)` / `rgb(r, g, b)`. */
export function versRvb(couleur: string): [number, number, number] {
  const c = couleur.trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 
      ? hex[1].split('').map((x) => x + x).join('')
      : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`Couleur non reconnue : « ${couleur} »`);
}

const canal = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(couleur: string): number {
  const [r, g, b] = versRvb(couleur);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Ratio de contraste WCAG, toujours ≥ 1, ordre des arguments indifférent. */
export function ratio(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}
