import { uniqueById } from './utils.js';

export function updateGraph(geojsonData) {
    const width = 600, height = 400;
    d3.select('#graph svg').remove();
    const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    // Собираем все существующие ref
    const allRefs = new Set(
        geojsonData.features
            .filter(f => f.properties && f.properties.ref)
            .map(f => f.properties.ref)
    );

    // Узлы: все объекты с ref
    const nodes = geojsonData.features
        .filter(f => f.properties && f.properties.ref)
        .map(f => ({
            id: f.properties.ref,
            name: f.properties.name || f.properties.ref || 'Unknown',
            type: f.properties.type || 'unknown',
        }));

    let links = [];

    // 1. Для каждого span ищем все pylon, которые на него ссылаются, и добавляем связь pylon -> span
    geojsonData.features.forEach(span => {
        if (!span.properties || span.properties.type !== 'span' || !span.properties.ref) return;
        const spanRef = span.properties.ref;
        geojsonData.features.forEach(pylon => {
            if (!pylon.properties || pylon.properties.type !== 'pylon' || !pylon.properties.system || !Array.isArray(pylon.properties.system.relations)) return;
            // pylon должен ссылаться на этот span
            if (pylon.properties.system.relations.some(r => (r.id || r.objectId) === spanRef)) {
                if (allRefs.has(pylon.properties.ref) && allRefs.has(spanRef)) {
                    links.push({ source: pylon.properties.ref, target: spanRef });
                }
            }
        });
    });

    // 2. Для каждого lines ищем все span, на которые он ссылается, и добавляем связь span -> lines
    geojsonData.features.forEach(lines => {
        if (!lines.properties || (lines.properties.type !== 'lines' && lines.properties.type !== 'fulllines') || !lines.properties.ref || !lines.properties.system || !Array.isArray(lines.properties.system.relations)) return;
        const linesRef = lines.properties.ref;
        lines.properties.system.relations.forEach(r => {
            const spanRef = r.id || r.objectId;
            // Только если span реально существует
            const spanFeature = geojsonData.features.find(f => f.properties && f.properties.type === 'span' && f.properties.ref === spanRef);
            if (spanFeature && allRefs.has(spanRef) && allRefs.has(linesRef)) {
                links.push({ source: spanRef, target: linesRef });
            }
        });
    });

    // D3 force layout
    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-100))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6);

    const node = svg.append('g')
        .selectAll('circle')
        .data(nodes)
        .enter().append('circle')
        .attr('r', 7)
        .attr('fill', d => d.type === 'pylon' ? '#ff0000' : d.type === 'span' ? '#00ff00' : d.type === 'lines' ? '#0000ff' : '#888888')
        .style('cursor', 'pointer')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended))
        .on('click', function(event, d) {
            // Находим feature по ref
            const feature = geojsonData.features.find(f => f.properties && f.properties.ref === d.id);
            if (feature) {
                // Диспатчим show-detail для показа модального окна
                window.dispatchEvent(new CustomEvent('show-detail', { detail: feature }));
            }
        });

    node.append('title').text(d => d.name);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
} 