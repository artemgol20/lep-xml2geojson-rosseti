export function setupFileLoader(onGeojsonLoaded) {
    const geojsonFileInput = document.getElementById('geojsonFile');
    if (geojsonFileInput) {
        geojsonFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.type || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
                        throw new Error('Invalid GeoJSON: Must be a FeatureCollection with features array');
                    }
                    onGeojsonLoaded(data);
                } catch (error) {
                }
            };
            reader.onerror = function() {
                alert('Error reading file. Please ensure it is a valid GeoJSON file.');
            };
            reader.readAsText(file);
        });
    }
} 