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
    if (feature.properties.type === 'span') {
        // Для span: строим диаграмму из двух опор и этой пролётки
        const pylonRefs = (feature.properties.system?.relations || []).map(r => r.id || r.objectId).filter(Boolean);
        const spanRef = feature.properties.ref;
        const spanName = feature.properties.name || spanRef;
        pylonRefs.forEach(pylonRef => {
            const pylonFeature = geojsonData.features.find(f =>
                f.properties &&
                f.properties.ref === pylonRef &&
                (f.properties.type === 'pylon' || f.properties.type === 'pylons')
            );
            const pylonLabel = pylonFeature && pylonFeature.properties.name
                ? pylonFeature.properties.name
                : pylonRef;
            mermaidDef += `    ${pylonRef}[\"${pylonLabel}\"] --> ${spanRef}[\"${spanName}\"]\n`;
        });
        // Добавим связь span -> line (если есть)
        let foundLine = geojsonData.features.find(f =>
            f.properties &&
            (f.properties.type === 'lines' || f.properties.type === 'fulllines') &&
            Array.isArray(f.properties.system?.relations) &&
            f.properties.system.relations.some(r => (r.id || r.objectId) === spanRef)
        );
        if (foundLine) {
            lineName = foundLine.properties.name || foundLine.properties.ref;
            mermaidDef += `    ${spanRef}[\"${spanName}\"] --> line[\"${lineName}\"]\n`;
        }
    } else if (feature.properties.type === 'pylon' || feature.properties.type === 'pylons') {
        // Для pylon: строим диаграмму "опора -> пролетки -> ЛЭП"
        const pylonRef = feature.properties.ref;
        const pylonName = feature.properties.name || pylonRef;
        // Найти все span, которые содержат этот pylon в своих relations
        const spans = geojsonData.features.filter(f =>
            f.properties &&
            (f.properties.type === 'span' || f.properties.type === 'spans') &&
            Array.isArray(f.properties.system?.relations) &&
            f.properties.system.relations.some(r => (r.id || r.objectId) === pylonRef)
        );
        spans.forEach(span => {
            const spanRef = span.properties.ref;
            const spanName = span.properties.name || spanRef;
            // Найти ЛЭП, который содержит эту span
            let foundLine = geojsonData.features.find(f =>
                f.properties &&
                (f.properties.type === 'lines' || f.properties.type === 'fulllines') &&
                Array.isArray(f.properties.system?.relations) &&
                f.properties.system.relations.some(r => (r.id || r.objectId) === spanRef)
            );
            let lineName = foundLine ? (foundLine.properties.name || foundLine.properties.ref) : 'ЛЭП';
            mermaidDef += `    ${pylonRef}[\"${pylonName}\"] --> ${spanRef}[\"${spanName}\"]\n`;
            mermaidDef += `    ${spanRef}[\"${spanName}\"] --> line[\"${lineName}\"]\n`;
        });
    } else {
        // Старый код для остальных случаев
        relations.forEach((rel, i) => {
            const relId = rel.id || rel.objectId || `rel${i}`;
            let spanName = relId;
            const spanFeature = geojsonData.features.find(f => f.properties && f.properties.ref === relId && f.properties.type === 'span');
            if (spanFeature) {
                spanName = spanFeature.properties.name || relId;
            }
            // Найти pylons, на которые ссылается span
            let pylonRefs = [];
            if (spanFeature && Array.isArray(spanFeature.properties.system?.relations)) {
                pylonRefs = spanFeature.properties.system.relations.map(r => r.id || r.objectId).filter(Boolean);
            }
            // Для каждого pylon добавить связь
            if (pylonRefs.length > 0) {
                pylonRefs.forEach(pylonRef => {
                    const pylonFeature = geojsonData.features.find(f =>
                        f.properties &&
                        f.properties.ref === pylonRef &&
                        (f.properties.type === 'pylon' || f.properties.type === 'pylons')
                    );
                    const pylonLabel = pylonFeature && pylonFeature.properties.name
                        ? pylonFeature.properties.name
                        : pylonRef;
                    mermaidDef += `    ${pylonRef}[\"${pylonLabel}\"] --> ${relId}[\"${spanName}\"]\n`;
                });
                mermaidDef += `    ${relId}[\"${spanName}\"] --> line[\"${lineName}\"]\n`;
            } else {
                // Если нет pylons, как раньше
                mermaidDef += `    ${ref}[\"${pylonName}\"] --> ${relId}[\"${spanName}\"]\n`;
                mermaidDef += `    ${relId}[\"${spanName}\"] --> line[\"${lineName}\"]\n`;
            }
        });
        if (relations.length === 0) {
            mermaidDef += `    ${ref}[\"${pylonName}\"] --> line[\"${lineName}\"]\n`;
        }
    }
    chart.innerHTML = `<div style=\"width:600px; height:400px; display:flex; justify-content:center; align-items:center; margin:auto;\"><div class=\"mermaid\" style=\"width:100%; height:100%;\">${mermaidDef}</div></div>`;
    chart.style.display = 'block';
    if (window.mermaid) {
        window.mermaid.run();
    }
    // Удаляю добавление обработчиков клика на узлы диаграммы
    // (блок setTimeout с обработчиками клика полностью убран)
    modal.classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.add('hidden');
});
