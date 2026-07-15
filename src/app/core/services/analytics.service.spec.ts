import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    delete (window as { umami?: unknown }).umami;
  });

  it('appelle window.umami.track quand Umami est chargé', () => {
    const trackSpy = vi.fn();
    window.umami = { track: trackSpy };

    service.track('avis_start', { ville: 'lyon-69123' });

    expect(trackSpy).toHaveBeenCalledWith('avis_start', { ville: 'lyon-69123' });
  });

  it("ne lève pas d'erreur si Umami n'est pas chargé", () => {
    expect(() => service.track('avis_start')).not.toThrow();
  });
});
