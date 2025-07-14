import { initMap, updateMap, setGeojsonData, getFilialData } from './map.js';
import { updateGraph } from './graph.js';
import { setupFilters } from './filters.js';
import { setupFileLoader } from './fileLoader.js';

const map = initMap();
let geojsonData = null;
let filialData = [];

function onGeojsonLoaded(data) {
    geojsonData = data;
    setGeojsonData(geojsonData);
    filialData = getFilialData(geojsonData);
    setupFilters(undefined, filialData, () => updateMap(map, geojsonData, undefined, filialData));
    updateMap(map, geojsonData, undefined, filialData);
    updateGraph(geojsonData);
}

setupFileLoader(onGeojsonLoaded);

window.addEventListener('show-detail', e => {
    showDetailModal(e.detail);
});

function showDetailModal(feature) {
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const content = document.getElementById('modalContent');
    const chart = document.getElementById('modalChart');

    title.textContent = `Details for ${feature.properties.name || 'Unknown'}`;
    content.innerHTML = '<pre>' + JSON.stringify(feature.properties, null, 2) + '</pre>';

    let lineName = 'ЛЭП';
    const pylonRef = feature.properties.ref;
    const spanFeatures = geojsonData.features.filter(f => f.properties && f.properties.type === 'span' && Array.isArray(f.properties.system?.relations) && f.properties.system.relations.some(r => r.objectId === pylonRef));
    let foundLine = null;
    for (const span of spanFeatures) {
        foundLine = geojsonData.features.find(f => f.properties && (f.properties.type === 'lines' || f.properties.type === 'fulllines') && Array.isArray(f.properties.system?.relations) && f.properties.system.relations.some(r => r.objectId === span.properties.ref));
        if (foundLine) break;
    }
    if (foundLine) {
        lineName = foundLine.properties.name || foundLine.properties.ref;
    }

    const ref = feature.properties.ref || 'unknown_ref';
    let pylonName = feature.properties.name || ref;
    const relations = feature?.properties?.system?.relations || [];
    let mermaidDef = `graph TD\n`;
    relations.forEach((rel, i) => {
        const relId = rel.id || rel.objectId || `rel${i}`;
        let spanName = relId;
        const spanFeature = geojsonData.features.find(f => f.properties && f.properties.ref === relId && f.properties.type === 'span');
        if (spanFeature) {
            spanName = spanFeature.properties.name || relId;
        }
        mermaidDef += `    ${ref}[\"${pylonName}\"] --> ${relId}[\"${spanName}\"]\n`;
        mermaidDef += `    ${relId} --> line[\"${lineName}\"]\n`;
    });
    if (relations.length === 0) {
        mermaidDef += `    ${ref}[\"${pylonName}\"] --> line[\"${lineName}\"]\n`;
    }
    chart.innerHTML = `<div style=\"width:600px; height:400px; display:flex; justify-content:center; align-items:center; margin:auto;\"><div class=\"mermaid\" style=\"width:100%; height:100%;\">${mermaidDef}</div></div>`;
    chart.style.display = 'block';
    if (window.mermaid) {
        window.mermaid.run();
    }
    modal.classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.add('hidden');
});
