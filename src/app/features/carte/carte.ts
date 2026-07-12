import { DecimalPipe, DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type * as L from 'leaflet';
import type { GeoLightFile, GeoLightItem } from '../../core/models/data.models';
import { MetaService } from '../../core/services/meta.service';
import { markerColor, markerRadius } from './marker-style';

@Component({
  selector: 'app-carte',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './carte.html',
  styleUrl: './carte.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Carte {
  readonly #doc = inject(DOCUMENT);
  readonly #meta = inject(MetaService);

  private readonly mapEl = viewChild.required<ElementRef<HTMLElement>>('map');

  readonly #geo = httpResource<GeoLightFile>(
    () => new URL('data/geo-light.json', this.#doc.baseURI).href,
  );

  protected readonly status = this.#geo.status;
  protected readonly noteMin = signal(0);

  /** Communes visibles selon le filtre de note minimum. */
  readonly #visibles = computed(() =>
    (this.#geo.value()?.items ?? []).filter((c) => c.g >= this.noteMin()),
  );
  protected readonly nbVisibles = computed(() => this.#visibles().length);
  protected readonly nbTotal = computed(() => this.#geo.value()?.items.length ?? 0);

  // Instances Leaflet (hors signaux : objets impératifs).
  #L: typeof L | null = null;
  #map: L.Map | null = null;
  #cluster: L.MarkerClusterGroup | null = null;
  readonly #ready = signal(false);

  constructor() {
    this.#meta.setPage({
      title: 'Carte des communes — ma ville, notée',
      description: 'Explorez la note de chaque commune française sur une carte interactive.',
      canonicalPath: '/carte',
    });

    // Leaflet ne s'initialise que dans le navigateur (accès au DOM).
    afterNextRender(async () => {
      const mod = await import('leaflet');
      // Le plugin markercluster augmente l'objet Leaflet runtime (module CJS).
      // Avec un import ESM, le namespace est figé à l'import : la méthode
      // `markerClusterGroup` n'apparaît que sur l'objet réel (`.default`).
      await import('leaflet.markercluster');
      const leaflet = ((mod as { default?: typeof L }).default ?? mod) as typeof L;
      this.#L = leaflet;

      const map = leaflet.map(this.mapEl().nativeElement, {
        center: [46.7, 2.4], // centre de la France
        zoom: 6,
        scrollWheelZoom: true,
      });
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18,
        })
        .addTo(map);

      this.#cluster = leaflet.markerClusterGroup({ chunkedLoading: true });
      map.addLayer(this.#cluster);
      this.#map = map;
      this.#ready.set(true);
    });

    // (Re)dessine les markers quand la carte est prête, que les données
    // arrivent, ou que le filtre change.
    effect(() => {
      const visibles = this.#visibles();
      if (!this.#ready() || !this.#L || !this.#cluster) return;
      this.#renderMarkers(visibles);
    });

    // Libère la carte Leaflet en quittant la page.
    inject(DestroyRef).onDestroy(() => this.#map?.remove());
  }

  #renderMarkers(items: readonly GeoLightItem[]): void {
    const leaflet = this.#L;
    const cluster = this.#cluster;
    if (!leaflet || !cluster) return;

    cluster.clearLayers();
    const base = this.#doc.baseURI.replace(/\/$/, '');
    const markers = items.map((c) => {
      const m = leaflet.circleMarker([c.lat, c.lng], {
        radius: markerRadius(c.p),
        color: markerColor(c.g),
        fillColor: markerColor(c.g),
        fillOpacity: 0.8,
        weight: 1,
      });
      m.bindPopup(
        `<b>${c.n}</b><br>${c.g.toFixed(1)}/10<br>` +
          `<a href="${base}/ville/${c.s}">Voir la fiche</a>`,
      );
      return m;
    });
    cluster.addLayers(markers);
  }
}
