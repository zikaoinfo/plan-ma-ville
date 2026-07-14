import { describe, expect, it } from 'vitest';
import { markerColor, markerRadius } from './marker-style';

describe('markerColor', () => {
  it('applique les seuils de la spec', () => {
    expect(markerColor(8)).toBe('#17754f'); // ≥ 7.5 vert
    expect(markerColor(6.5)).toBe('#d9a514'); // ≥ 6 jaune
    expect(markerColor(5)).toBe('#e67e22'); // ≥ 4 orange
    expect(markerColor(3)).toBe('#c93a2e'); // < 4 rouge
    expect(markerColor(7.5)).toBe('#17754f'); // borne incluse
  });
});

describe('markerRadius', () => {
  it('dimensionne selon la population', () => {
    expect(markerRadius(500)).toBe(5);
    expect(markerRadius(50_000)).toBe(7);
    expect(markerRadius(500_000)).toBe(10);
    expect(markerRadius(10_000)).toBe(7); // borne incluse
    expect(markerRadius(100_000)).toBe(10); // borne incluse
  });
});
