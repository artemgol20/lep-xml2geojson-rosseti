import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';

// Вспомогательные функции поиска по ref
function getByRef(geojson, ref) {
  return geojson.features.find(f => f.properties.ref === ref);
}

function getRelations(geojson, feature) {
  if (!feature?.properties?.relations) return [];
  return feature.properties.relations
    .map(r => getByRef(geojson, r.objectId))
    .filter(Boolean);
}

// Построение дерева с корректными edges для reactflow
function buildTree(geojson, feature, level = 0, parentId = null, nodes = [], edges = [], yStart = 0, siblingCount = 1, siblingIndex = 0) {
  if (!feature) return { nodes, edges, nextY: yStart };
  const id = feature.properties.ref;
  const y = yStart + siblingIndex * 120;
  nodes.push({
    id,
    data: {
      label: String(feature.properties.name || id),
      type: String(feature.properties.type),
      voltage: feature.properties.voltage ? String(feature.properties.voltage) : undefined,
      warning: feature.warning ? String(feature.warning) : undefined
    },
    position: { x: level * 300, y },
    style: {
      borderRadius: 12,
      padding: 8,
      background: level === 0 ? '#3b82f6' : level === 1 ? '#f59e42' : level === 2 ? '#a3e635' : '#fff',
      color: level < 3 ? '#fff' : '#222',
      fontWeight: 600,
      minWidth: 120,
      boxShadow: '0 4px 16px rgba(60,72,88,0.10)'
    }
  });
  if (parentId) {
    edges.push({
      id: `${parentId}-${id}`,
      source: parentId,
      target: id,
      animated: true,
      type: 'smoothstep',
      sourcePosition: 'right',
      targetPosition: 'left',
      style: { stroke: '#3b82f6', strokeWidth: 3 }
    });
  }
  const children = getRelations(geojson, feature);
  let nextY = y;
  children.forEach((child, i) => {
    const res = buildTree(geojson, child, level + 1, id, nodes, edges, y, children.length, i);
    nextY = Math.max(nextY, res.nextY);
  });
  return { nodes, edges, nextY: nextY + (children.length ? 120 : 0) };
}

function CustomNode({ data, id, selected, onClick }) {
  return (
    <div
      style={{
        padding: 8,
        borderRadius: 10,
        background: selected ? '#f59e42' : 'inherit',
        color: selected ? '#fff' : 'inherit',
        boxShadow: selected ? '0 4px 24px #f59e42aa' : '0 2px 8px rgba(60,72,88,0.10)',
        cursor: data.type === 'pylons' ? 'pointer' : 'default',
        border: selected ? '2px solid #f59e42' : 'none',
        transition: 'background 0.3s, color 0.3s, box-shadow 0.3s, border 0.3s',
      }}
      onClick={() => data.type === 'pylons' && onClick && onClick(id)}
      title={data.type === 'pylons' ? 'Показать опору на карте' : ''}
    >
      <div style={{ fontWeight: 700, fontSize: '1.08em' }}>{data.label}</div>
      <div style={{ fontSize: '0.95em', opacity: 0.8 }}>{data.type}</div>
      {data.voltage && <div style={{ fontSize: '0.93em', color: '#f59e42' }}>{data.voltage} кВ</div>}
      {data.warning && <div style={{ color: '#e11d48', fontSize: '0.92em', marginTop: 4 }}>{data.warning}</div>}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export default function ConnectionDiagram({ geojson, rootRef, selectedRef }) {
  const root = getByRef(geojson, rootRef);
  const { nodes, edges } = useMemo(() => {
    const { nodes, edges } = buildTree(geojson, root);
    return { nodes, edges };
  }, [geojson, rootRef]);
  const navigate = useNavigate();
  const nodesWithType = nodes.map(n => ({ ...n, type: 'custom', selected: n.id === selectedRef }));

  const handleNodeClick = (ref) => {
    localStorage.setItem('flyToPylon', ref);
    window.dispatchEvent(new CustomEvent('flyToPylon', { detail: ref }));
    localStorage.setItem('highlightPylon', ref); // для эффекта на карте
    navigate('/map');
  };

  const nodeTypesWithClick = {
    custom: (props) => <CustomNode {...props} selected={props.id === selectedRef} onClick={handleNodeClick} />
  };

  if (!root) return <div>Объект не найден</div>;
  return (
    <div style={{ height: 600, background: 'var(--main-bg)', borderRadius: 16, boxShadow: 'var(--shadow)', margin: '2em 0' }}>
      <ReactFlow
        nodes={nodesWithType}
        edges={edges}
        fitView
        panOnScroll
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        nodeTypes={nodeTypesWithClick}
      >
        <MiniMap />
        <Controls />
        <Background gap={16} />
      </ReactFlow>
    </div>
  );
} 