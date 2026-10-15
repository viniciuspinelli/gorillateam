// Séries com repetições diferentes são guardadas como lista por série em
// `reps` ("20 / 8 / 8" com sets = 3). Estas funções convertem entre esse
// formato e variações agrupadas ([{ sets: 1, reps: '20' }, { sets: 2, reps: '8' }]).
// Usado no navegador (window.SetsReps) e no servidor (require).
(function (root) {
    function splitReps(sets, reps) {
        const parts = String(reps || '').split('/').map(s => s.trim()).filter(Boolean);
        return parts.length > 1 && parts.length === Number(sets) ? parts : null;
    }

    function toVariations(sets, reps) {
        const parts = splitReps(sets, reps);
        if (!parts) return [{ sets: Number(sets) || '', reps: String(reps || '') }];
        const groups = [];
        parts.forEach(p => {
            const last = groups[groups.length - 1];
            if (last && last.reps === p) last.sets++;
            else groups.push({ sets: 1, reps: p });
        });
        return groups;
    }

    function fromVariations(variations) {
        const valid = variations.filter(v => Number(v.sets) > 0 && String(v.reps).trim());
        if (valid.length === 0) return null;
        const sets = valid.reduce((sum, v) => sum + Number(v.sets), 0);
        if (valid.length === 1) return { sets, reps: String(valid[0].reps).trim() };
        // "/" separa as séries, então não pode aparecer dentro de uma variação
        const perSet = [];
        valid.forEach(v => {
            const reps = String(v.reps).trim().replace(/\s*\/\s*/g, '-');
            for (let i = 0; i < Number(v.sets); i++) perSet.push(reps);
        });
        return { sets, reps: perSet.join(' / ') };
    }

    // "3x 20 / 8 / 8" -> "1x20 + 2x8"; formatos simples continuam "4x10"
    function format(sets, reps) {
        if (!splitReps(sets, reps)) return sets + 'x' + reps;
        return toVariations(sets, reps).map(v => v.sets + 'x' + v.reps).join(' + ');
    }

    const api = { toVariations, fromVariations, format };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SetsReps = api;
})(typeof window !== 'undefined' ? window : this);
