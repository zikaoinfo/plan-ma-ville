import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  CommuneDetail,
  Critere,
  DepartementDetailFile,
  SearchIndexFile,
} from '../../core/models/data.models';
import { Commune } from './commune';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function crit(v: number): Record<Critere, number> {
  return {
    securite: v,
    sante: v,
    commerces: v,
    enseignement: v,
    sports: v,
    culture: v,
    transports: v,
    niveauVie: v,
  };
}

function detail(slug: string, nom: string, lat: number, lon: number, global: number): CommuneDetail {
  return {
    slug,
    nom,
    codeInsee: slug.split('-').pop() as string,
    codesPostaux: ['69001'],
    population: 50000,
    lat,
    lon,
    score: { source: 'computed', global, criteres: crit(global) },
    prix: {
      m2: 4200,
      periode: '2025-S1',
      nb: 120,
      histo: [
        { p: '2024-S1', v: 4000 },
        { p: '2024-S2', v: 4100 },
        { p: '2025-S1', v: 4200 },
      ],
    },
  };
}

const INDEX: SearchIndexFile = {
  v: 1,
  gen: '2026-06-13',
  items: [
    { n: 'Lyon', nn: 'lyon', cp: ['69001'], d: '69', s: 'lyon-69123', i: '69123', p: 522250, g: 6.2 },
  ],
};

const DEPS = {
  v: 1 as const,
  gen: '2026-06-13',
  items: [{ code: '69', nom: 'Rhône', nbCommunes: 3, noteMoyenne: 6 }],
};

const REGIONS = {
  v: 1 as const,
  gen: '2026-06-13',
  items: [
    {
      code: '84',
      nom: 'Auvergne-Rhône-Alpes',
      nbDepartements: 1,
      nbCommunes: 3,
      noteMoyenne: 6,
      departements: [{ code: '69', nom: 'Rhône', nbCommunes: 3, noteMoyenne: 6 }],
    },
  ],
};

const DEP69: DepartementDetailFile = {
  v: 1,
  gen: '2026-06-13',
  code: '69',
  nom: 'Rhône',
  communes: [
    detail('lyon-69123', 'Lyon', 45.758, 4.8357, 6.2),
    detail('villeurbanne-69266', 'Villeurbanne', 45.7733, 4.8902, 6.8),
    detail('caluire-69034', 'Caluire-et-Cuire', 45.7956, 4.8467, 4.9),
  ],
};

describe('Commune', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Commune],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  /** Attend qu'une requête vers `urlEnd` soit émise (httpResource est async), puis la sert. */
  async function flushWhenReady(
    fixture: { detectChanges(): void },
    urlEnd: string,
    body: object,
  ): Promise<void> {
    for (let i = 0; i < 12; i++) {
      fixture.detectChanges();
      const reqs = ctrl.match((r) => r.url.endsWith(urlEnd));
      if (reqs.length) {
        reqs.forEach((r) => r.flush(body));
        return;
      }
      await tick();
    }
    throw new Error(`Aucune requête émise vers ${urlEnd}`);
  }

  it('affiche le skeleton tant que les données ne sont pas chargées', async () => {
    const fixture = TestBed.createComponent(Commune);
    fixture.componentRef.setInput('slug', 'lyon-69123');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.skeleton')).toBeTruthy();

    await tick();
    ctrl.match(() => true).forEach((r) => r.flush(INDEX));
  });

  it('rend le dashboard complet une fois les données chargées', async () => {
    const fixture = TestBed.createComponent(Commune);
    fixture.componentRef.setInput('slug', 'lyon-69123');

    await flushWhenReady(fixture, '/data/index.json', INDEX);
    await flushWhenReady(fixture, '/data/departements.json', DEPS);
    await flushWhenReady(fixture, '/data/regions.json', REGIONS);
    await flushWhenReady(fixture, '/data/dep/69.json', DEP69);

    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await tick();
    }

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Lyon');
    expect(el.querySelector('.card--map iframe')).toBeTruthy();
    expect(el.querySelector('.card--price .price')).toBeTruthy();
    expect(el.querySelector('.card--histo .maj__date')?.textContent).toContain('13 juin 2026');
    expect(el.querySelectorAll('.card--themes app-note-bar').length).toBe(8);

    const noms = [...el.querySelectorAll('.near__name')].map((n) => n.textContent?.trim());
    expect(noms).toContain('Villeurbanne');
    expect(noms).toContain('Caluire-et-Cuire');
    expect(noms).not.toContain('Lyon');
  });
});
