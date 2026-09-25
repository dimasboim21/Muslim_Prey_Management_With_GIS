(function () {
    'use strict';
    // Optional numeric attributes in vector tiles must not be asserted as numbers
    // until their type is known. Missing ranks do not qualify for ranked labels.
    function guardFilter(value) {
        if (!Array.isArray(value)) return value;
        if (value[0] === 'literal') return value;
        const result = value.map((item, index) => index ? guardFilter(item) : item);
        if (['<', '<=', '>', '>='].includes(result[0]) && result.length === 3) {
            const position = typeof result[2] === 'number' ? 1 : typeof result[1] === 'number' ? 2 : -1;
            const operand = result[position];
            if (Array.isArray(operand) && operand[0] === 'get') {
                result[position] = ['number', operand, 0];
                return ['all', ['==', ['typeof', operand], 'number'], result];
            }
        }
        return result;
    }
    async function apply(layer, styleName) {
        if (!['bright', 'fiord', 'positron', 'dark'].includes(styleName)) throw new Error('Unknown map style');
        const response = await fetch('https://tiles.openfreemap.org/styles/' + styleName);
        if (!response.ok) throw new Error('OpenFreeMap style HTTP ' + response.status);
        const style = await response.json();
        if (!Array.isArray(style.layers)) throw new Error('Invalid OpenFreeMap style');
        style.layers = style.layers.map((entry) => entry.filter ? { ...entry, filter: guardFilter(entry.filter) } : entry);
        return window.olms.applyStyle(layer, style, 'openmaptiles');
    }
    window.MpmOpenFreeMapStyle = { apply, guardFilter };
}());
