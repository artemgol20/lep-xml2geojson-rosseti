import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ConnectionDiagram from "./ConnectionDiagram";

export default function LEPChart({ geojson }) {
  const { lepId } = useParams();
  const navigate = useNavigate();
  const [selectedPylon, setSelectedPylon] = useState(null);

  useEffect(() => {
    // Проверяем, есть ли ref опоры для выделения
    const ref = localStorage.getItem('selectedPylonRef');
    if (ref) {
      setSelectedPylon(ref);
      localStorage.removeItem('selectedPylonRef');
    }
  }, [lepId]);

  return (
    <div>
      <h2>Диаграмма связей ЛЭП</h2>
      <ConnectionDiagram geojson={geojson} rootRef={lepId} selectedRef={selectedPylon} />
      <button onClick={() => navigate(-1)}>Назад к списку ЛЭП</button>
    </div>
  );
} 