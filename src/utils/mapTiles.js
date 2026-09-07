export function mapTileConfig(apiKey = import.meta.env.VITE_CARTO_API_KEY) {
  const key = apiKey?.trim();
  const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  if (key) {
    return {
      url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      options: {
        attribution: `${osmAttribution} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
        subdomains: 'abcd',
        maxZoom: 19,
      },
    };
  }
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { attribution: osmAttribution, maxZoom: 19 },
  };
}
