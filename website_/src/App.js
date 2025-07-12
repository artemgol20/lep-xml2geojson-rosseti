import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import MapView from "./MapView";
import LEPList from "./LEPList";
import { geojson } from './geojson';
// Основной компонент приложения
export default function App() {
  return (
    <Router>
      <div style={{ padding: 16 }}>
        <h1>GeoJSON Viewer</h1>
        {/* Навигация по вкладкам */}
        <nav style={{ marginBottom: 16 }}>
          <Link to="/map" style={{ marginRight: 16 }}>Карта</Link>
          <Link to="/leps">ЛЭП</Link>
        </nav>
        {/* Роутинг по вкладкам */}
        <Routes>
          <Route path="/map" element={<MapView />} />
          <Route path="/leps/*" element={<LEPList />} />
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </div>
    </Router>
  );
} 