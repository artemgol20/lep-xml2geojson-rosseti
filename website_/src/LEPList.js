import './index.css';
import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation, useParams } from "react-router-dom";
import { loadGeojson } from "./geojson";
import LEPChart from "./LEPChart";

export default function LEPList() {
  const [geojson, setGeojson] = useState(null);
  useEffect(() => {
    loadGeojson().then(setGeojson);
  }, []);
  if (!geojson) return <div>Загрузка ЛЭП...</div>;
  return (
    <Routes>
      <Route path="/" element={<LEPTable geojson={geojson} />} />
      <Route path=":lepId" element={<LEPChart geojson={geojson} />} />
    </Routes>
  );
}

function LEPTable({ geojson }) {
  const leps = geojson.features.filter(f => f.properties.type === "fulllines");
  const location = useLocation();
  const activeLep = location.pathname.split("/").pop();
  return (
    <div className="lep-list card">
      <h2>Список ЛЭП</h2>
      <ul>
        {leps.map(lep => {
          const isActive = activeLep === lep.properties.ref;
          return (
            <li key={lep.properties.ref} className={isActive ? "active" : ""}>
              <Link to={"/leps/" + lep.properties.ref}>{lep.properties.name || lep.properties.ref}</Link>
              <span style={{ fontSize: "0.95em", color: "var(--accent)", marginLeft: 8 }}>
                {lep.properties.voltage ? lep.properties.voltage + " кВ" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
} 