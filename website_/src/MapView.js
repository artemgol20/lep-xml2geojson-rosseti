import React, { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { loadGeojson } from "./geojson";
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import { HeatmapLayer } from 'react-leaflet-heatmap-layer-v3';

// Иконка для опор
const pylonIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Центр карты по умолчанию
const defaultCenter = [53.233179101, 50.284959828];

// Компонент для перемещения карты к объекту
function FlyTo({ position }) {
  const map = useMap();
  React.useEffect(() => {
    if (position) map.flyTo(position, 13);
  }, [position, map]);
  return null;
}

export default function MapView() {
  const [spanColor, setSpanColor] = useState("#3388ff");
  const [flyTo, setFlyTo] = useState(null);
  const markerRefs = useRef({});
  const [geojson, setGeojson] = useState(null);

  useEffect(() => {
    loadGeojson().then(setGeojson);
  }, []);

  if (!geojson) return <div>Загрузка карты...</div>;

  const pylons = geojson.features.filter(f => f.properties.type === "pylons" && f.geometry);
  const spans = geojson.features.filter(f => f.properties.type === "span" && f.geometry);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        Цвет пролеток:
        <input type="color" value={spanColor} onChange={e => setSpanColor(e.target.value)} style={{ marginLeft: 8 }} />
      </div>
      <MapContainer center={defaultCenter} zoom={7} style={{ height: "70vh", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {/* Кластеризация опор */}
        <MarkerClusterGroup>
          {pylons.map(f => (
            <Marker
              key={f.properties.ref}
              position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
              icon={pylonIcon}
              ref={el => markerRefs.current[f.properties.ref] = el}
            >
              <Popup>
                <b>{f.properties.name}</b><br />
                <span>Тип: Опора</span><br />
                <span>ID: {f.properties.ref}</span><br />
                <span>Напряжение: {f.properties.voltage} кВ</span><br />
                {/* Связи */}
                {f.properties.relations && f.properties.relations.length > 0 && (
                  <div>
                    <b>Связанные объекты:</b>
                    <ul>
                      {f.properties.relations.map((rel, i) => (
                        <li key={i}>{rel.objectId}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        {/* Пролетки */}
        {spans.map(f => (
          <Polyline
            key={f.properties.ref}
            positions={f.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
            pathOptions={{ color: spanColor, weight: 4 }}
          >
            <Popup>
              <b>{f.properties.name || "Пролетка"}</b><br />
              <span>Тип: Пролетка</span><br />
              <span>ID: {f.properties.ref}</span><br />
              <span>Напряжение: {f.properties.voltage} кВ</span><br />
              {/* Связи */}
              {f.properties.relations && f.properties.relations.length > 0 && (
                <div>
                  <b>Связанные объекты:</b>
                  <ul>
                    {f.properties.relations.map((rel, i) => (
                      <li key={i}>{rel.objectId}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Popup>
          </Polyline>
        ))}
        {/* Перемещение к объекту по flyTo */}
        {flyTo && <FlyTo position={flyTo} />}
        <HeatmapLayer
          points={pylons.map(f => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            value: 1
          }))}
          longitudeExtractor={m => m.lng}
          latitudeExtractor={m => m.lat}
          intensityExtractor={m => m.value}
        />
      </MapContainer>
    </div>
  );
} 