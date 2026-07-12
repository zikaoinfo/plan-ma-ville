import { describe, expect, it } from 'vitest';
import { communeParent } from '../src/fetch/insee-code.js';
import { makeBpeAccumulator, typequToCritere } from '../src/fetch/bpe.js';
import { makeSecuriteAccumulator } from '../src/fetch/securite.js';
import { buildFilosofiMap, detectValueCol } from '../src/fetch/filosofi.js';

describe('communeParent', () => {
  it('rattache les arrondissements à leur commune mère', () => {
    expect(communeParent('75108')).toBe('75056'); // Paris 8e
    expect(communeParent('69382')).toBe('69123'); // Lyon 2e
    expect(communeParent('13210')).toBe('13055'); // Marseille 10e
  });
  it('laisse les autres codes intacts (dont Corse)', () => {
    expect(communeParent('01001')).toBe('01001');
    expect(communeParent('2A004')).toBe('2A004');
    expect(communeParent('2B033')).toBe('2B033');
  });
});

describe('typequToCritere', () => {
  it('mappe les domaines BPE vers les critères', () => {
    expect(typequToCritere('B203')).toBe('commerces');
    expect(typequToCritere('C104')).toBe('enseignement');
    expect(typequToCritere('D201')).toBe('sante');
    expect(typequToCritere('E107')).toBe('transports');
    expect(typequToCritere('F101')).toBe('sports');
    expect(typequToCritere('F303')).toBe('culture');
  });
  it('ignore services (A) et tourisme (G)', () => {
    expect(typequToCritere('A101')).toBeUndefined();
    expect(typequToCritere('G101')).toBeUndefined();
  });
});

describe('makeBpeAccumulator', () => {
  it('somme une colonne NB et agrège les arrondissements', () => {
    const acc = makeBpeAccumulator();
    acc.add({ DEPCOM: '75101', TYPEQU: 'F303', NB: '3' }); // culture Paris 1er
    acc.add({ DEPCOM: '75108', TYPEQU: 'F303', NB: '2' }); // culture Paris 8e
    acc.add({ DEPCOM: '75108', TYPEQU: 'D201', NB: '4' }); // santé Paris 8e
    acc.add({ DEPCOM: '75108', TYPEQU: 'A101', NB: '9' }); // service : ignoré
    const paris = acc.result().get('75056')!;
    expect(paris.culture).toBe(5);
    expect(paris.sante).toBe(4);
  });

  it('compte 1 par ligne si aucune colonne d’effectif (fichier détaillé)', () => {
    const acc = makeBpeAccumulator();
    acc.add({ DEPCOM: '69123', TYPEQU: 'E107' });
    acc.add({ DEPCOM: '69123', TYPEQU: 'E107' });
    expect(acc.result().get('69123')!.transports).toBe(2);
  });

  it('gère le format large (1 colonne par TYPEQU = dénombrement communal)', () => {
    const acc = makeBpeAccumulator();
    acc.add({ DEPCOM: '01001', B201: '3', D201: '2', F303: '1', A101: '5' });
    const c = acc.result().get('01001')!;
    expect(c.commerces).toBe(3);
    expect(c.sante).toBe(2);
    expect(c.culture).toBe(1);
    // A101 (services) hors critères → non compté.
    expect(c.transports).toBe(0);
  });
});

describe('makeSecuriteAccumulator', () => {
  it('ne garde que le dernier millésime et somme les classes', () => {
    const acc = makeSecuriteAccumulator();
    acc.add({ CODGEO: '69123', annee: '2022', classe: 'Vols', faits: '10' });
    acc.add({ CODGEO: '69123', annee: '2023', classe: 'Vols', faits: '20' });
    acc.add({ CODGEO: '69123', annee: '2023', classe: 'Cambriolages', faits: '5' });
    acc.add({ CODGEO: '69123', annee: '2023', classe: 'Coups', faits: '' }); // masqué → ignoré
    expect(acc.millesime()).toBe(2023);
    expect(acc.result().get('69123')).toBe(25);
  });

  it('fond les arrondissements sur la commune mère', () => {
    const acc = makeSecuriteAccumulator();
    acc.add({ CODGEO: '13201', annee: '2023', faits: '7' });
    acc.add({ CODGEO: '13202', annee: '2023', faits: '3' });
    expect(acc.result().get('13055')).toBe(10);
  });
});

describe('buildFilosofiMap / detectValueCol', () => {
  it('choisit la colonne médiane du millésime le plus récent', () => {
    expect(detectValueCol(['CODGEO', 'MED20', 'MED21', 'TP60'])).toBe('MED21');
    expect(detectValueCol(['CODGEO', 'Q221'])).toBe('Q221');
  });

  it('construit la map et ignore les communes sous secret', () => {
    const rows = [
      { CODGEO: '01001', MED21: '22000' },
      { CODGEO: '01002', MED21: '' }, // secret statistique
      { CODGEO: '75101', MED21: '30000' }, // arrondissement → mère
    ];
    const map = buildFilosofiMap(rows);
    expect(map.get('01001')).toBe(22000);
    expect(map.has('01002')).toBe(false);
    expect(map.get('75056')).toBe(30000);
  });
});
