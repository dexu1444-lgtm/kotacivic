let mapInstance = null;
let markersLayer = null;

function initMap(issues) {
  const el = document.getElementById('map');
  if (!el || typeof L === 'undefined') return;

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }

  mapInstance = L.map('map').setView([25.2138, 75.8648], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(mapInstance);

  markersLayer = L.layerGroup().addTo(mapInstance);

  (issues || []).forEach(issue => {
    if (issue.lat == null || issue.lng == null) return;
    const color = {
      open: '#3b82f6',
      in_progress: '#f59e0b',
      resolved: '#22c55e',
      rejected: '#ef4444'
    }[issue.status] || '#3b82f6';

    L.circleMarker([issue.lat, issue.lng], {
      radius: 9,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9
    }).bindPopup(
      '<strong>' + (issue.type || '') + '</strong><br/>' +
      (issue.location || '') + '<br/>Status: ' + (issue.status || '')
    ).addTo(markersLayer);
  });
}
