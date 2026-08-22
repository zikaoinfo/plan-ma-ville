import { describe, expect, it } from 'vitest';
import { CRITERES } from '../../core/models/data.models';
import {
  NB_CRITERES,
  NB_SOURCES,
  NB_SOURCES_NOTE,
  RAPPEL_METHODE,
  SOURCES,
} from './methodologie-chiffres';

describe('chiffres de méthodologie', () => {
  /**
   * Le site affirme publiquement le nombre de critères sur lequel il note :
   * s'il divergeait de la liste réelle, l'affirmation serait fausse — et
   * vérifiable d'un coup d'œil au tableau des notes.
   */
  it('annonce autant de critères qu’il en existe réellement', () => {
    expect(NB_CRITERES).toBe(CRITERES.length);
  });

  it('dérive les totaux de la liste des sources, sans les recopier', () => {
    expect(NB_SOURCES).toBe(SOURCES.length);
    expect(NB_SOURCES_NOTE).toBe(SOURCES.filter((s) => s.entreDansLaNote).length);
    expect(NB_SOURCES_NOTE).toBeLessThanOrEqual(NB_SOURCES);
  });

  it('décrit chaque source complètement', () => {
    for (const s of SOURCES) {
      expect(s.domaine.length).toBeGreaterThan(0);
      expect(s.source.length).toBeGreaterThan(0);
      expect(s.millesime.length).toBeGreaterThan(0);
    }
  });

  it('couvre les sources qui alimentent la note', () => {
    const notees = SOURCES.filter((s) => s.entreDansLaNote).map((s) => s.source).join(' ');
    expect(notees).toContain('BPE');
    expect(notees).toContain('SSMSI');
    expect(notees).toContain('Filosofi');
  });

  it('reprend les chiffres dans la phrase de rappel', () => {
    expect(RAPPEL_METHODE).toContain(`${NB_CRITERES} critères`);
    expect(RAPPEL_METHODE).toContain(`${NB_SOURCES} sources`);
    expect(RAPPEL_METHODE).toContain(`${NB_SOURCES_NOTE} entrent dans la note`);
  });
});
