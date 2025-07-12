// Загрузка GeoJSON через fetch из public/output.geojson
export async function loadGeojson() {
  const res = await fetch('/output.geojson');
  if (!res.ok) throw new Error('Не удалось загрузить output.geojson');
  return await res.json();
} 