import { uniqueById } from './utils.js';

export function updateGraph(geojsonData) {
    const width = 600, height = 400;
    d3.select('#graph svg').remove();
    const svg = d3.select('#graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    const nodes = geojsonData.features
        .filter(f => f.properties)
        .map(f => ({
            id: f.properties.ref,
            name: f.properties.name || 'Unknown',
            type: 'pylon'
        }));
    const links = geojsonData.features
        .filter(f => f.properties && f.properties.system && Array.isArray(f.properties.system.relations))
        .flatMap(f =>
            f.properties.system.relations.map(r => ({
                source: f.properties.ref,
                target: r.id
            }))
        );
    const relationNodes = geojsonData.features
        .filter(f => f.properties && f.properties.system && Array.isArray(f.properties.system.relations))
        .flatMap(f =>
            f.properties.system.relations.map(r => ({
                id: r.id,
                name: r.id.slice(0, 8) + '...',
                type: r.type === 'parameter' ? 'parameter' : 'tech_place'
            }))
        );
    nodes.push(...uniqueById(relationNodes));
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
        .attr('r', 5)
        .attr('fill', d => d.type === 'pylon' ? '#ff0000' : d.type === 'parameter' ? '#00ff00' : '#0000ff')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
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