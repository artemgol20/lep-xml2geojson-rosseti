import React, { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { loadGeojson } from "./geojson";
import MarkerClusterGroup from '@changey/react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import '@changey/react-leaflet-markercluster/dist/styles.min.css';
import { useNavigate } from 'react-router-dom';
import './index.css';

// Иконка для опор
const pylonIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const defaultCenter = [53.233179101, 50.284959828];
const FLY_ZOOM = 17; // увеличенный зум при переходе к опоре

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, FLY_ZOOM);
  }, [position, map]);
  return null;
}

export default function MapView() {
  const [spanColor, setSpanColor] = useState("#3388ff");
  const [flyTo, setFlyTo] = useState(null);
  const markerRefs = useRef({});
  const [geojson, setGeojson] = useState(null);
  const [popupPylon, setPopupPylon] = useState(null); // ref опоры для открытия popup
  const navigate = useNavigate();

  useEffect(() => {
    loadGeojson().then(setGeojson);
  }, []);

  // Обработка перехода к опоре по ref (flyTo и popup)
  useEffect(() => {
    function handleFlyToPylon(e) {
      const ref = e?.detail || localStorage.getItem('flyToPylon');
      if (!ref || !geojson) return;
      const pylon = geojson.features.find(f => f.properties.type === 'pylons' && f.properties.ref === ref);
      if (pylon && pylon.geometry) {
        setFlyTo([pylon.geometry.coordinates[1], pylon.geometry.coordinates[0]]);
        setPopupPylon(ref);
      }
      localStorage.removeItem('flyToPylon');
    }
    window.addEventListener('flyToPylon', handleFlyToPylon);
    handleFlyToPylon();
    return () => window.removeEventListener('flyToPylon', handleFlyToPylon);
  }, [geojson]);

  useEffect(() => {
    if (
      popupPylon &&
      markerRefs.current[popupPylon] &&
      markerRefs.current[popupPylon].openPopup
    ) {
      // Даем React время отрисовать маркеры
      setTimeout(() => {
        if (
          markerRefs.current[popupPylon] &&
          markerRefs.current[popupPylon].openPopup
        ) {
          markerRefs.current[popupPylon].openPopup();
        }
      }, 500); // 100 мс обычно достаточно
    }
  }, [popupPylon, geojson]);

  if (!geojson) return <div>Загрузка карты...</div>;

  const pylons = geojson.features.filter(f => f.properties.type === "pylons" && f.geometry);
  const spans = geojson.features.filter(f => f.properties.type === "span" && f.geometry);

  // Переход к диаграмме по опоре
  function handleShowInDiagram(pylon) {
    // Находим ЛЭП для этой опоры (по связям вверх)
    // Для простоты: ищем ЛЭП, в связях которого есть участок, в связях которого есть пролет, в связях которого есть эта опора
    let lepId = null;
    for (const lep of geojson.features.filter(f => f.properties.type === 'fulllines')) {
      const sectionIds = lep.properties.relations?.map(r => r.objectId) || [];
      for (const sectionId of sectionIds) {
        const section = geojson.features.find(f => f.properties.ref === sectionId);
        if (!section) continue;
        const spanIds = section.properties.relations?.map(r => r.objectId) || [];
        for (const spanId of spanIds) {
          const span = geojson.features.find(f => f.properties.ref === spanId);
          if (!span) continue;
          const pylonIds = span.properties.relations?.map(r => r.objectId) || [];
          if (pylonIds.includes(pylon.properties.ref)) {
            lepId = lep.properties.ref;
            break;
          }
        }
        if (lepId) break;
      }
      if (lepId) break;
    }
    if (lepId) {
      localStorage.setItem('selectedPylonRef', pylon.properties.ref);
      navigate(`/leps/${lepId}`);
    } else {
      alert('Не удалось найти ЛЭП для этой опоры');
    }
  }

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
        <MarkerClusterGroup>
          {pylons.map(f => (
            <Marker
              key={f.properties.ref}
              position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
              icon={pylonIcon}
              ref={el => markerRefs.current[f.properties.ref] = el}
              eventHandlers={{
                popupopen: () => setPopupPylon(f.properties.ref)
              }}
            >
              <Popup autoPan={true}>
                <b>{f.properties.name}</b><br />
                <span>Тип: Опора</span><br />
                <span>ID: {f.properties.ref}</span><br />
                <span>Напряжение: {f.properties.voltage} кВ</span><br />
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
                <button className="btn" style={{ marginTop: 8 }} onClick={() => handleShowInDiagram(f)}>
                  Показать в диаграмме
                </button>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
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
      </MapContainer>
    </div>
  );
} 