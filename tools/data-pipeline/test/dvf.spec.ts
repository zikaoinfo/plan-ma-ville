import { describe, expect, it } from 'vitest';
import { makeDvfAccumulator, prioriteType } from '../src/fetch/dvf.js';

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
