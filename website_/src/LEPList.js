import React, { useEffect, useState } from "react";
import { Routes, Route, Link, useNavigate, useParams } from "react-router-dom";
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
  return (
    <div>
      <h2>Список ЛЭП</h2>
      <ul>
        {leps.map(lep => (
          <li key={lep.properties.ref}>
            <Link to={"/leps/" + lep.properties.ref}>{lep.properties.name || lep.properties.ref}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
} 