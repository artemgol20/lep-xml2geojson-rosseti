import { initMap, updateMap, setGeojsonData } from './map.js';
import { updateGraph } from './graph.js';
import { setupFilters } from './filters.js';
import { setupFileLoader } from './fileLoader.js';

const map = initMap();
let geojsonData = null;

function getFilialData(data) {
    const rawFilialData = (data || geojsonData).features
        .filter(f => f.properties && f.properties.filial)
        .map(f => ({
            id: f.properties.filial,
            name: `Filial ${f.properties.filial.slice(0, 8)}...`
        }));
    // Уникальные по id
    const seen = new Set();
    return rawFilialData.filter(item => {
        if (!item.id) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

function onGeojsonLoaded(data) {
    geojsonData = data;
    setGeojsonData(geojsonData);
    const filialData = getFilialData(geojsonData);
    setupFilters(filialData, () => updateMap(map, geojsonData, filialData));
    updateMap(map, geojsonData, filialData);
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

    // Вспомогательные функции для поиска родителей и детей
    function findParentLines(spanRef) {
        return geojsonData.features.filter(f =>
            f.properties &&
            (f.properties.type === 'lines' || f.properties.type === 'fulllines') &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === spanRef)
        );
    }
    function findParentFullLines(lineRef) {
        return geojsonData.features.filter(f =>
            f.properties &&
            f.properties.type === 'fulllines' &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === lineRef)
        );
    }
    function findSpansOfLine(lineRef) {
        return geojsonData.features.filter(f =>
            f.properties &&
            f.properties.type === 'span' &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === lineRef)
        );
    }
    function findSpansOfFullLine(fullLineRef) {
        // Для fulllines ищем lines, а потом их spans
        const lines = geojsonData.features.filter(f =>
            f.properties &&
            f.properties.type === 'lines' &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === fullLineRef)
        );
        let spans = [];
        lines.forEach(line => {
            spans = spans.concat(findSpansOfLine(line.properties.ref));
        });
        return spans;
    }
    function findPylonsOfSpan(spanRef) {
        const span = geojsonData.features.find(f => f.properties && f.properties.ref === spanRef && f.properties.type === 'span');
        if (!span) return [];
        return (span.system?.relations || [])
            .map(r => geojsonData.features.find(f => f.properties && f.properties.ref === (r.id || r.objectId) && (f.properties.type === 'pylon' || f.properties.type === 'pylons')))
            .filter(Boolean);
    }
    function findSpansOfPylon(pylonRef) {
        return geojsonData.features.filter(f =>
            f.properties &&
            f.properties.type === 'span' &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === pylonRef)
        );
    }

    // Построение диаграммы
    let mermaidDef = `graph TD\n`;
    const type = feature.properties.type;
    const ref = feature.properties.ref;
    const name = feature.properties.name || ref;
    const addedLinks = new Set();
    function addLink(from, to, fromName, toName) {
        const key = `${from}->${to}`;
        if (!addedLinks.has(key)) {
            mermaidDef += `    ${from}[\"${fromName}\"] --> ${to}[\"${toName}\"]\n`;
            addedLinks.add(key);
        }
    }

    if (type === 'pylon' || type === 'pylons') {
        // Для опоры: путь от fulllines -> lines -> span -> pylon
        const spans = findSpansOfPylon(ref);
        spans.forEach(span => {
            const spanRef = span.properties.ref;
            const spanName = span.properties.name || spanRef;
            const parentLines = findParentLines(spanRef);
            parentLines.forEach(line => {
                const lineRef = line.properties.ref;
                const lineName = line.properties.name || lineRef;
                const parentFullLines = findParentFullLines(lineRef);
                if (parentFullLines.length > 0) {
                    parentFullLines.forEach(fullLine => {
                        const fullLineRef = fullLine.properties.ref;
                        const fullLineName = fullLine.properties.name || fullLineRef;
                        addLink(fullLineRef, lineRef, fullLineName, lineName);
                    });
                }
                addLink(lineRef, spanRef, lineName, spanName);
            });
            addLink(spanRef, ref, spanName, name);
        });
        if (spans.length === 0) {
            mermaidDef += `    ${ref}[\"${name}\"]\n`;
        }
    } else if (type === 'span') {
        // Для пролета: путь от fulllines -> lines -> span, плюс опоры
        const parentLines = findParentLines(ref);
        parentLines.forEach(line => {
            const lineRef = line.properties.ref;
            const lineName = line.properties.name || lineRef;
            const parentFullLines = findParentFullLines(lineRef);
            if (parentFullLines.length > 0) {
                parentFullLines.forEach(fullLine => {
                    const fullLineRef = fullLine.properties.ref;
                    const fullLineName = fullLine.properties.name || fullLineRef;
                    addLink(fullLineRef, lineRef, fullLineName, lineName);
                });
            }
            addLink(lineRef, ref, lineName, name);
        });
        // Опоры
        const pylons = findPylonsOfSpan(ref);
        pylons.forEach(pylon => {
            const pylonRef = pylon.properties.ref;
            const pylonName = pylon.properties.name || pylonRef;
            addLink(ref, pylonRef, name, pylonName);
        });
    } else if (type === 'lines') {
        // Для lines: путь от fulllines -> lines, плюс все spans
        const parentFullLines = findParentFullLines(ref);
        parentFullLines.forEach(fullLine => {
            const fullLineRef = fullLine.properties.ref;
            const fullLineName = fullLine.properties.name || fullLineRef;
            addLink(fullLineRef, ref, fullLineName, name);
        });
        const spans = findSpansOfLine(ref);
        spans.forEach(span => {
            const spanRef = span.properties.ref;
            const spanName = span.properties.name || spanRef;
            addLink(ref, spanRef, name, spanName);
        });
    } else if (type === 'fulllines') {
        // Для fulllines: все lines и их spans
        const lines = geojsonData.features.filter(f =>
            f.properties &&
            f.properties.type === 'lines' &&
            Array.isArray(f.system?.relations) &&
            f.system.relations.some(r => (r.id || r.objectId) === ref)
        );
        lines.forEach(line => {
            const lineRef = line.properties.ref;
            const lineName = line.properties.name || lineRef;
            addLink(ref, lineRef, name, lineName);
            const spans = findSpansOfLine(lineRef);
            spans.forEach(span => {
                const spanRef = span.properties.ref;
                const spanName = span.properties.name || spanRef;
                addLink(lineRef, spanRef, lineName, spanName);
                const pylons = findPylonsOfSpan(spanRef);
                pylons.forEach(pylon => {
                    const pylonRef = pylon.properties.ref;
                    const pylonName = pylon.properties.name || pylonRef;
                    addLink(spanRef, pylonRef, spanName, pylonName);
                });
            });
        });
    } else {
        // Если тип неизвестен — просто показать имя
        mermaidDef += `    ${ref}[\"${name}\"]\n`;
    }

    chart.innerHTML = `<div class=\"mermaid\" style=\"width:100%; height:100%; max-width:600px;\">${mermaidDef}</div>`;
    // Добавим стили для .mermaid, чтобы текст был читаемым и диаграмма всегда растягивалась
    const mermaidStyle = document.createElement('style');
    mermaidStyle.innerHTML = `
        #modalChart .mermaid svg {
            width: 100% !important;
            height: 100% !important;
        }
        #modalChart .mermaid * {
            font-size: 16px !important;
            font-family: 'Inter', 'Arial', sans-serif !important;
        }
        #modalChart .mermaid .nodeLabel {
            font-size: 16px !important;
            font-family: 'Inter', 'Arial', sans-serif !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        #modalChart .mermaid .label {
            font-size: 16px !important;
            font-family: 'Inter', 'Arial', sans-serif !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
    `;
    // Удаляем старые стили, если есть
    const oldStyle = document.getElementById('mermaid-modal-style');
    if (oldStyle) oldStyle.remove();
    mermaidStyle.id = 'mermaid-modal-style';
    document.head.appendChild(mermaidStyle);
    chart.style.display = 'block';
    if (window.mermaid) {
        window.mermaid.run();
    }
    modal.classList.remove('hidden');
}

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.add('hidden');
});
