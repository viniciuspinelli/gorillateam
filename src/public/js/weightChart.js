function renderWeightChart(canvasId, weightLogs) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined' || !weightLogs || weightLogs.length === 0) return;

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: weightLogs.map((w) => new Date(w.recordedAt + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
            datasets: [{
                label: 'Peso (kg)',
                data: weightLogs.map((w) => parseFloat(w.weight)),
                borderColor: '#F24A00',
                backgroundColor: 'rgba(242, 74, 0, 0.15)',
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: '#F24A00',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#94A3B8' }, grid: { color: '#151B26' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: '#151B26' } },
            },
        },
    });
}
