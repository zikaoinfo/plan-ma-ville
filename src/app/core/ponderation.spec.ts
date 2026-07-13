import { describe, expect, it } from 'vitest';
import { CRITERES, type Critere } from './models/data.models';
import {
  noteGlobalePonderee,
  POIDS_OFFICIELS,
  PROFILS,
  profilById,
  sanitisePoids,
  sanitiseProfil,
} from './ponderation';

function criteres(v: number, sauf: Partial<Record<Critere, number>> = {}): Record<Critere, number> {
  return { ...(Object.fromEntries(CRITERES.map((c) => [c, v])) as Record<Critere, number>), ...sauf };
}

describe('PROFILS', () => {
  it('contient les 5 profils, officiel en premier', () => {
    expect(PROFILS.map((p) => p.id)).toEqual(['officiel', 'famille', 'actif', 'retraite', 'perso']);
  });

  it('chaque preset couvre les 8 critères avec des poids dans [0, 2]', () => {
    for (const p of PROFILS) {
      if (!p.poids) continue; // perso
      for (const c of CRITERES) {
        expect(p.poids[c], `${p.id}.${c}`).toBeGreaterThanOrEqual(0);
        expect(p.poids[c], `${p.id}.${c}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('famille privilégie enseignement et sécurité ; actif privilégie transports', () => {
    const famille = profilById('famille').poids!;
    const actif = profilById('actif').poids!;
    expect(famille.enseignement).toBeGreaterThan(POIDS_OFFICIELS.enseignement);
    expect(famille.securite).toBeGreaterThan(POIDS_OFFICIELS.securite);
    expect(actif.transports).toBeGreaterThan(POIDS_OFFICIELS.transports);
    expect(actif.enseignement).toBeLessThan(POIDS_OFFICIELS.enseignement);
  });
});

describe('noteGlobalePonderee', () => {
  it('notes uniformes → même note quelle que soit la pondération', () => {
    expect(noteGlobalePonderee(criteres(7), POIDS_OFFICIELS)).toBe(7);
    expect(noteGlobalePonderee(criteres(7), profilById('famille').poids!)).toBe(7);
  });

  it('surpondérer un critère fort remonte la note', () => {
    const c = criteres(5, { enseignement: 10 });
    const officiel = noteGlobalePonderee(c, POIDS_OFFICIELS);
    const famille = noteGlobalePonderee(c, profilById('famille').poids!);
    expect(famille).toBeGreaterThan(officiel);
  });

  it('poids 0 → critère ignoré', () => {
    const c = criteres(8, { securite: 0 });
    const sansSecurite = noteGlobalePonderee(c, sanitisePoids({ ...POIDS_OFFICIELS, securite: 0 }));
    expect(sansSecurite).toBe(8);
  });

  it('tous les poids à 0 → moyenne simple (pas de division par zéro)', () => {
    const zero = sanitisePoids(Object.fromEntries(CRITERES.map((c) => [c, 0])));
    expect(noteGlobalePonderee(criteres(6, { culture: 10 }), zero)).toBe(6.5);
  });

  it('arrondit à une décimale', () => {
    const n = noteGlobalePonderee(criteres(7, { securite: 8 }), POIDS_OFFICIELS);
    expect(n).toBe(Math.round(n * 10) / 10);
  });
});

describe('sanitiseProfil / sanitisePoids', () => {
  it('replie un profil inconnu sur officiel', () => {
    expect(sanitiseProfil('famille')).toBe('famille');
    expect(sanitiseProfil('xyz')).toBe('officiel');
    expect(sanitiseProfil(null)).toBe('officiel');
  });

  it('borne les poids dans [0, 2] et remplace le non-numérique', () => {
    const p = sanitisePoids({ securite: 99, sante: -3, culture: 'abc', transports: 1.27 });
    expect(p.securite).toBe(2);
    expect(p.sante).toBe(0);
    expect(p.culture).toBe(POIDS_OFFICIELS.culture);
    expect(p.transports).toBe(1.3); // arrondi 0.1
    expect(p.niveauVie).toBe(POIDS_OFFICIELS.niveauVie); // absent → officiel
  });

  it("entrée totalement invalide → poids officiels", () => {
    expect(sanitisePoids(null)).toEqual(POIDS_OFFICIELS);
    expect(sanitisePoids('garbage')).toEqual(POIDS_OFFICIELS);
  });
});
