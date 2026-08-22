import { describe, expect, it } from 'vitest';
import {
  makeDvfAccumulator,
  prioriteType,
  varianteColonne,
  varianteColonneNb,
} from '../src/fetch/dvf.js';

/** Ligne type « Statistiques DVF » (format large, une colonne par mesure). */
function row(
  code: string,
  periode: string,
  med: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    code_geo: code,
    libelle_geo: 'X',
    echelle_geo: 'commune',
    annee_semestre: periode,
    med_prix_m2_appartement_maison: med,
    nb_ventes_appartement_maison: '12',
    ...extra,
  };
}

describe('makeDvfAccumulator', () => {
  it('agrège la médiane par commune et retient la dernière période + historique', () => {
    const acc = makeDvfAccumulator();
    acc.add(row('69123', '2024-S1', '4100'));
    acc.add(row('69123', '2024-S2', '4180'));
    acc.add(row('69123', '2025-S1', '4250'));
    const m = acc.result();
    const lyon = m.get('69123')!;
    expect(lyon.m2).toBe(4250);
    expect(lyon.periode).toBe('2025-S1');
    expect(lyon.nb).toBe(12);
    expect(lyon.histo.map((h) => h.p)).toEqual(['2024-S1', '2024-S2', '2025-S1']);
    expect(lyon.histo.map((h) => h.v)).toEqual([4100, 4180, 4250]);
  });

  it("ignore les échelles non communales et les médianes vides/nulles", () => {
    const acc = makeDvfAccumulator();
    acc.add(row('69', '2025-S1', '4000', { echelle_geo: 'departement' }));
    acc.add(row('69123', '2025-S1', ''));
    acc.add(row('69124', '2025-S1', '0'));
    expect(acc.result().size).toBe(0);
  });

  it("replie les arrondissements sur la commune mère ET garde le prix de l'arrondissement", () => {
    const acc = makeDvfAccumulator();
    acc.add(row('75101', '2025-S1', '11000'));
    const m = acc.result();
    expect(m.has('75056')).toBe(true);
    expect(m.get('75056')!.m2).toBe(11000);
    expect(m.get('75101')!.m2).toBe(11000);
  });

  it('somme les ventes de PLUSIEURS arrondissements sur la commune mère (pas un seul écrasant les autres)', () => {
    const acc = makeDvfAccumulator();
    // 3 arrondissements différents, même période : chacun garde son propre
    // prix/nb, la mère (75056) doit cumuler le nb et pondérer le prix.
    acc.add(row('75101', '2025-S1', '11000', { nb_ventes_appartement_maison: '10' }));
    acc.add(row('75115', '2025-S1', '9000', { nb_ventes_appartement_maison: '30' }));
    acc.add(row('75120', '2025-S1', '7000', { nb_ventes_appartement_maison: '20' }));
    const m = acc.result();
    // Chaque arrondissement garde sa propre valeur, non affectée par les autres.
    expect(m.get('75101')!.m2).toBe(11000);
    expect(m.get('75101')!.nb).toBe(10);
    expect(m.get('75115')!.m2).toBe(9000);
    // La mère cumule le nombre de ventes de ses 3 arrondissements (pas 10 ou 30 seul).
    const paris = m.get('75056')!;
    expect(paris.nb).toBe(60); // 10 + 30 + 20
    // Prix pondéré par nb : (11000*10 + 9000*30 + 7000*20) / 60 ≈ 8667
    expect(paris.m2).toBe(8667);
  });

  it('format « long » (colonne type de bien) : priorité au résidentiel combiné', () => {
    const acc = makeDvfAccumulator();
    const long = (type: string, med: string) => ({
      code_geo: '31555',
      echelle_geo: 'commune',
      annee_semestre: '2025-S1',
      type_de_bien: type,
      med_prix_m2: med,
    });
    acc.add(long('Maison', '3000'));
    acc.add(long('Appartement + Maison', '3400'));
    acc.add(long('Local industriel', '900')); // hors sujet → ignoré
    const m = acc.result();
    expect(m.get('31555')!.m2).toBe(3400);
  });

  it('parse les nombres au format FR (virgule décimale)', () => {
    const acc = makeDvfAccumulator();
    acc.add(row('13055', '2025-S1', '2984,5'));
    expect(acc.result().get('13055')!.m2).toBe(2985); // arrondi entier
  });

  it("borne l'historique aux 10 dernières périodes", () => {
    const acc = makeDvfAccumulator();
    for (let a = 2014; a <= 2025; a++) {
      acc.add(row('69123', `${a}-S1`, String(3000 + a - 2014)));
    }
    const histo = acc.result().get('69123')!.histo;
    expect(histo).toHaveLength(10);
    expect(histo[0].p).toBe('2016-S1');
    expect(histo[9].p).toBe('2025-S1');
  });

  it('lève une erreur claire si les colonnes sont introuvables', () => {
    const acc = makeDvfAccumulator();
    expect(() => acc.add({ foo: '1', bar: '2' })).toThrow(/colonnes code\/médiane/);
  });
});

describe('prioriteType', () => {
  it('classe combiné < maison < appartement, inconnu = -1', () => {
    expect(prioriteType('Appartement + Maison')).toBe(0);
    expect(prioriteType('Tous types')).toBe(0);
    expect(prioriteType('Maison')).toBe(1);
    expect(prioriteType('Appartement')).toBe(2);
    expect(prioriteType('Local commercial')).toBe(-1);
  });
});

// ── Split maison / appartement (différenciation #3) ──

/** Ligne « large » ventilée par type de bien, comme le millésime DVF réel. */
function rowSplit(
  code: string,
  periode: string,
  vals: { ensemble?: string; maison?: string; appart?: string },
  nbs: { ensemble?: string; maison?: string; appart?: string } = {},
): Record<string, string> {
  return {
    code_geo: code,
    echelle_geo: 'commune',
    annee_semestre: periode,
    ...(vals.ensemble ? { med_prix_m2_appartement_maison: vals.ensemble } : {}),
    ...(vals.maison ? { med_prix_m2_maison: vals.maison } : {}),
    ...(vals.appart ? { med_prix_m2_appartement: vals.appart } : {}),
    ...(nbs.ensemble ? { nb_ventes_appartement_maison: nbs.ensemble } : {}),
    ...(nbs.maison ? { nb_ventes_maison: nbs.maison } : {}),
    ...(nbs.appart ? { nb_ventes_appartement: nbs.appart } : {}),
  };
}

describe('varianteColonne / varianteColonneNb', () => {
  /**
   * Le classement se fait par PRÉSENCE des deux mots : `med_prix_m2_appartement_maison`
   * contient « maison » et « appartement », c'est le combiné. Un simple
   * `/maison/` le prendrait pour la colonne des maisons seules et publierait
   * l'agrégat sous le libellé « maisons ».
   */
  it('reconnaît le combiné, les maisons, les appartements et la colonne générique', () => {
    expect(varianteColonne('med_prix_m2_appartement_maison')).toBe('ensemble');
    expect(varianteColonne('med_prix_m2_maisons_apparts')).toBe('ensemble');
    expect(varianteColonne('med_prix_m2_maison')).toBe('maison');
    expect(varianteColonne('med_prix_m2_appartement')).toBe('appartement');
    expect(varianteColonne('med_prix_m2')).toBe('ensemble');
  });

  it('ignore les colonnes hors sujet', () => {
    expect(varianteColonne('moy_surface_maison')).toBeUndefined();
    expect(varianteColonne('libelle_geo')).toBeUndefined();
    expect(varianteColonneNb('nb_ventes_maison')).toBe('maison');
    expect(varianteColonneNb('nb_ventes_appartement_maison')).toBe('ensemble');
    expect(varianteColonneNb('med_prix_m2_maison')).toBeUndefined();
  });
});

describe('split maison / appartement', () => {
  it('publie les trois séries quand la source les distingue', () => {
    const acc = makeDvfAccumulator();
    acc.add(
      rowSplit(
        '69123',
        '2024-S2',
        { ensemble: '4100', maison: '5200', appart: '3900' },
        { ensemble: '100', maison: '20', appart: '80' },
      ),
    );
    acc.add(
      rowSplit(
        '69123',
        '2025-S1',
        { ensemble: '4250', maison: '5400', appart: '4000' },
        { ensemble: '120', maison: '25', appart: '95' },
      ),
    );
    const lyon = acc.result().get('69123')!;
    expect(lyon.m2).toBe(4250);
    expect(lyon.maison).toMatchObject({ m2: 5400, nb: 25 });
    expect(lyon.appartement).toMatchObject({ m2: 4000, nb: 95 });
    expect(lyon.maison?.histo).toEqual([
      { p: '2024-S2', v: 5200 },
      { p: '2025-S1', v: 5400 },
    ]);
  });

  it("n'invente aucune ventilation quand la source ne la fournit pas", () => {
    const acc = makeDvfAccumulator();
    acc.add(row('13055', '2025-S1', '3100'));
    const m = acc.result().get('13055')!;
    expect(m.m2).toBe(3100);
    expect(m.maison).toBeUndefined();
    expect(m.appartement).toBeUndefined();
  });

  /**
   * PIÈGE signalé dans le plan : l'agrégation des arrondissements sur leur
   * commune mère doit s'appliquer INDÉPENDAMMENT à chaque variante. Si la
   * dimension « origine » n'existait qu'au niveau agrégé, un arrondissement
   * écraserait les maisons des autres et Paris hériterait d'un nombre de
   * ventes dérisoire — le bug déjà corrigé sur l'agrégat, rejoué sur le split.
   */
  it('combine les arrondissements par variante, sans écrasement', () => {
    const acc = makeDvfAccumulator();
    acc.add(
      rowSplit('75101', '2025-S1', { maison: '14000', appart: '12000' }, { maison: '2', appart: '40' }),
    );
    acc.add(
      rowSplit('75115', '2025-S1', { maison: '10000', appart: '9000' }, { maison: '8', appart: '160' }),
    );
    const m = acc.result();

    // Chaque arrondissement conserve ses propres valeurs.
    expect(m.get('75101')!.maison).toMatchObject({ m2: 14000, nb: 2 });
    expect(m.get('75115')!.appartement).toMatchObject({ m2: 9000, nb: 160 });

    const paris = m.get('75056')!;
    // Maisons : 2 + 8 ventes, prix pondéré (14000*2 + 10000*8) / 10 = 10800.
    expect(paris.maison).toMatchObject({ nb: 10, m2: 10800 });
    // Appartements : 40 + 160, (12000*40 + 9000*160) / 200 = 9600.
    expect(paris.appartement).toMatchObject({ nb: 200, m2: 9600 });
  });

  it('format « long » : chaque type de bien alimente sa propre variante', () => {
    const acc = makeDvfAccumulator();
    const long = (type: string, med: string, nb: string) => ({
      code_geo: '31555',
      echelle_geo: 'commune',
      annee_semestre: '2025-S1',
      type_de_bien: type,
      med_prix_m2: med,
      nb_ventes: nb,
    });
    acc.add(long('Maison', '3000', '50'));
    acc.add(long('Appartement', '3600', '150'));
    acc.add(long('Appartement + Maison', '3400', '200'));
    acc.add(long('Local industriel', '900', '5'));
    const t = acc.result().get('31555')!;
    expect(t.m2).toBe(3400);
    expect(t.maison).toMatchObject({ m2: 3000, nb: 50 });
    expect(t.appartement).toMatchObject({ m2: 3600, nb: 150 });
  });

  it('retombe sur les maisons si la source ne publie pas de combiné', () => {
    const acc = makeDvfAccumulator();
    acc.add(rowSplit('01001', '2025-S1', { maison: '2200' }, { maison: '9' }));
    const c = acc.result().get('01001')!;
    expect(c.m2).toBe(2200);
    expect(c.maison).toMatchObject({ m2: 2200 });
    expect(c.appartement).toBeUndefined();
  });
});
