export function uniqueById(array, key = 'id') {
    const seen = new Set();
    return array.filter(item => {
        if (!item[key]) return false;
        if (seen.has(item[key])) return false;
        seen.add(item[key]);
        return true;
    });
} 