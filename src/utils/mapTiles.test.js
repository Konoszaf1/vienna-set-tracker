import { describe, expect, it } from 'vitest';
import { mapTileConfig } from './mapTiles';

describe('map tile configuration', () => {
  it('uses OpenStreetMap without a configured key', () => {
    for (const key of ['', '  ', undefined]) {
      const tiles = mapTileConfig(key);
      expect(tiles.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
      expect(tiles.options.attribution).toContain('OpenStreetMap');
      expect(tiles.options.attribution).not.toContain('CARTO');
    }
  });

  it('encodes the CARTO key and attributes both providers', () => {
    const tiles = mapTileConfig(' key&value=1 ');
    expect(tiles.url).toContain('?key=key%26value%3D1');
    expect(tiles.url).toContain('cartocdn.com');
    expect(tiles.options.attribution).toContain('OpenStreetMap');
    expect(tiles.options.attribution).toContain('CARTO');
  });
});
