import { geojson } from './geojson';// Вспомогательные функции для работы с geojson

// Найти все объекты по типу
export function getFeaturesByType(geojson, type) {
  return geojson.features.filter(f => f.properties.type === type);
}

// Найти объект по ref
export function getFeatureByRef(geojson, ref) {
  return geojson.features.find(f => f.properties.ref === ref);
}

// Найти объекты, связанные с данным (по relations)
export function getRelatedFeatures(geojson, feature) {
  if (!feature.properties.relations) return [];
  const ids = feature.properties.relations.map(r => r.objectId);
  return geojson.features.filter(f => ids.includes(f.properties.ref));
} 