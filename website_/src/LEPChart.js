import './index.css';
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Компонент диаграммы по выбранной ЛЭП
export default function LEPChart({ geojson }) {
  const { lepId } = useParams();
  const navigate = useNavigate();
  // Найти объект ЛЭП
  const lep = geojson.features.find(f => f.properties.ref === lepId);
  // Найти связанные участки
  const sectionIds = lep?.properties.relations?.map(r => r.objectId) || [];
  // Найти все пролеты и опоры, относящиеся к этим участкам
  const spans = geojson.features.filter(f => f.properties.type === "span" && f.properties.relations && sectionIds.includes(f.properties.relations[0]?.objectId));
  const pylons = geojson.features.filter(f => f.properties.type === "pylons" && f.properties.relations && sectionIds.some(id => f.properties.relations.map(r => r.objectId).includes(id)));

  // Данные для диаграммы
  const data = [
    { name: "Пролетки", count: spans.length, type: "span" },
    { name: "Опоры", count: pylons.length, type: "pylons" }
  ];

  // Клик по столбцу — переход к карте (emit event)
  function handleBarClick(data, index) {
    alert(`Показать на карте: ${data.name}`);
    navigate("/map");
  }

  return (
    <div>
      <h2>Диаграмма по ЛЭП: {lep?.properties.name || lepId}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" onClick={handleBarClick} />
        </BarChart>
      </ResponsiveContainer>
      <button onClick={() => navigate(-1)}>Назад к списку ЛЭП</button>
    </div>
  );
} 