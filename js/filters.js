export function setupFilters(_voltageData, filialData, onChange) {
    const filialFilter = document.getElementById('filialFilter');
    if (filialFilter) {
        filialFilter.innerHTML = '<option value="all">All</option>';
        filialData.forEach(f => {
            const option = document.createElement('option');
            option.value = f.id;
            option.textContent = f.name;
            filialFilter.appendChild(option);
        });
        filialFilter.addEventListener('change', onChange);
    }
} 