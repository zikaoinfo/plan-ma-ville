import { describe, expect, it } from 'vitest';
import { avecSlashFinal, sansSlashFinal } from './slash-final';

describe('avecSlashFinal', () => {
  it('ajoute le slash final à un chemin simple', () => {
    expect(avecSlashFinal('/ville/lyon-69123')).toBe('/ville/lyon-69123/');
    expect(avecSlashFinal('/departement/94')).toBe('/departement/94/');
    expect(avecSlashFinal('/palmares/securite/94')).toBe('/palmares/securite/94/');
  });

  it('laisse la racine et un chemin déjà terminé par / inchangés', () => {
    expect(avecSlashFinal('/')).toBe('/');
    expect(avecSlashFinal('/ville/lyon-69123/')).toBe('/ville/lyon-69123/');
  });

  it('insère le slash AVANT la query et le fragment', () => {
    expect(avecSlashFinal('/ville/lyon-69123?onglet=avis')).toBe('/ville/lyon-69123/?onglet=avis');
    expect(avecSlashFinal('/comparer?villes=a,b')).toBe('/comparer/?villes=a,b');
    // Retour OAuth Supabase : le fragment #access_token ne doit pas être touché.
    expect(avecSlashFinal('/ville/lyon-69123?onglet=avis#access_token=x')).toBe(
      '/ville/lyon-69123/?onglet=avis#access_token=x',
    );
    expect(avecSlashFinal('/?q=paris')).toBe('/?q=paris');
  });
});

describe('sansSlashFinal', () => {
  it('retire le slash final', () => {
    expect(sansSlashFinal('/ville/lyon-69123/')).toBe('/ville/lyon-69123');
    expect(sansSlashFinal('/departement/94/')).toBe('/departement/94');
  });

  it('préserve la racine', () => {
    expect(sansSlashFinal('/')).toBe('/');
    expect(sansSlashFinal('//')).toBe('/');
  });

  it('ne touche ni à la query ni au fragment', () => {
    expect(sansSlashFinal('/ville/lyon-69123/?onglet=avis')).toBe('/ville/lyon-69123?onglet=avis');
    expect(sansSlashFinal('/ville/lyon-69123/#access_token=x')).toBe(
      '/ville/lyon-69123#access_token=x',
    );
    expect(sansSlashFinal('/?q=a/')).toBe('/?q=a/');
  });

  it("n'altère pas une URL déjà sans slash final", () => {
    expect(sansSlashFinal('/ville/lyon-69123')).toBe('/ville/lyon-69123');
  });
});

describe('aller-retour', () => {
  it('est stable : les deux formes convergent vers la forme canonique', () => {
    for (const u of ['/ville/x', '/ville/x/', '/', '/comparer?villes=a']) {
      expect(avecSlashFinal(sansSlashFinal(u))).toBe(avecSlashFinal(u));
    }
  });
});
