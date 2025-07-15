import { uniqueById } from './utils.js';

let mapInstance = null;
let markers = null;
let geojsonData = null;
let voltageData = [];
let filialData = [];
let markerCluster = null;

export function initMap() {
    mapInstance = L.map('map').setView([53.169245, 43.982288], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);
    // markers и кластер инициализируются только после загрузки данных
    return mapInstance;
}

export function setGeojsonData(data) {
    geojsonData = data;
    voltageData = getVoltageData(geojsonData);
    filialData = getFilialData(geojsonData);
}

export function getVoltageData(data) {
    const rawVoltageData = (data || geojsonData).features
        .filter(f => f.properties && f.properties.voltage_id && f.properties.voltage)
        .map(f => ({
            id: f.properties.voltage_id,
            name: `${f.properties.voltage} кВ`,
            voltage: f.properties.voltage
        }));
    return uniqueById(rawVoltageData);
}

export function getFilialData(data) {
    const rawFilialData = (data || geojsonData).features
        .filter(f => f.properties && f.properties.filial)
        .map(f => ({
            id: f.properties.filial,
            name: `Filial ${f.properties.filial.slice(0, 8)}...`
        }));
    return uniqueById(rawFilialData);
}

export function updateMap(map = mapInstance, data = geojsonData, _voltageList, filialList = filialData) {
    const selectedFilial = document.getElementById('filialFilter').value;

    // Очищаем старый кластер, если он уже есть
    if (markerCluster) {
        markerCluster.clearLayers();
        map.removeLayer(markerCluster);
        markerCluster = null;
    }

    // Если данных нет — ничего не делаем
    if (!data) return;

    markerCluster = L.markerClusterGroup();
    const geoJsonLayer = L.geoJSON(data, {
        filter: feature => {
            if (!feature.properties) return false;
            return (selectedFilial === 'all' || feature.properties.filial === selectedFilial);
        },
        onEachFeature: function(feature, layer) {
            if (!feature.properties) return;
            layer.bindPopup(`
                <b>${feature.properties.name || 'Unknown'}</b><br>
                ID: ${feature.properties.IdDZO || 'N/A'}<br>
                Ref: ${feature.properties.ref || 'N/A'}<br>
                Voltage: ${feature.properties.voltage || 'N/A'} кВ<br>
                Filial: ${filialList.find(f => f.id === feature.properties.filial)?.name || feature.properties.filial || 'N/A'}<br>
                <button data-ref="${feature.properties.ref}" class="more-info-btn bg-blue-500 text-white px-2 py-1 mt-2 rounded">More Info</button>
            `);
        }
    });
    markerCluster.addLayer(geoJsonLayer);
    map.addLayer(markerCluster);
    markers = markerCluster;

    if (geoJsonLayer.getBounds().isValid()) {
        map.fitBounds(geoJsonLayer.getBounds());
    }

    map.on('popupopen', function (e) {
        const popupNode = e.popup.getElement();
        const button = popupNode.querySelector('.more-info-btn');
        if (button) {
            button.addEventListener('click', () => {
                const ref = button.dataset.ref;
                const feature = geojsonData.features.find(f => f.properties && f.properties.ref === ref);
                if (feature) {
                    showDetailModal(feature);
                }
            });
        }
    });
}

function showDetailModal(feature) {
    const event = new CustomEvent('show-detail', { detail: feature });
    window.dispatchEvent(event);
}
