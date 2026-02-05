// --- CONFIGURATION ---
// REPLACE WITH YOUR TOKEN
mapboxgl.accessToken = 'pk.eyJ1IjoianVsaW92aWVqbyIsImEiOiJja2Y3NHBtM2gwd3M2MnNydmIxYjYxa2lvIn0.puI9pJXRVKcgpBONE8cYXA';

// Neon / High Contrast Colors for Dark Mode
const categoryColors = {
    'Radioactive': '#FF3333',       // Bright Red
    'Dioxins & Furans': '#D000D0',  // Neon Purple
    'Explosives': '#FF9900',        // Bright Orange
    'PCBs': '#FF5500',              // Red-Orange
    'Pesticides': '#00FF00',        // Lime Green
    'Metals': '#00CCFF',            // Cyan
    'VOCs': '#3366FF',              // Royal Blue
    'SVOCs': '#6633FF',             // Blue-Purple
    'Asbestos': '#FFFFFF',          // White
    'Cyanides': '#00FFFF',          // Aqua
    'Other': '#FFFF00',             // Yellow
    'Unknown': '#444444'            // Dark Grey
};

// --- STATE MANAGEMENT ---
let bookmarks = JSON.parse(localStorage.getItem('superfundBookmarks')) || [];

// --- MAP INITIALIZATION ---
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11', // Dark base style
    center: [-98.5795, 39.8283], // Center of US
    zoom: 3.5,
    projection: 'globe' // 3D Globe view
});

// --- STYLE & LAYERS ---
map.on('style.load', () => {
    // 1. CRITICAL: Make map background transparent so the network canvas shows through
    map.setBackgroundColor('rgba(0,0,0,0)');
    
    // 2. Disable atmosphere/star fog to remove the "weird blue hue"
    map.setFog({
        'color': 'rgba(0,0,0,0)',
        'high-color': 'rgba(0,0,0,0)',
        'horizon-blend': 0,
        'space-color': 'rgba(0,0,0,0)',
        'star-intensity': 0
    });
});

map.on('load', () => {
    // Add Source
    map.addSource('superfund-sites', {
        type: 'geojson',
        data: 'data/superfund_sites.json'
    });

    // LAYER 1: The Glow (Behind the dots)
    // Larger radius, high blur, lower opacity
    map.addLayer({
        id: 'sites-glow',
        type: 'circle',
        source: 'superfund-sites',
        paint: {
            'circle-radius': 12, // Large glow radius
            'circle-blur': 1,    // Maximum blur for soft effect
            'circle-opacity': 0.4,
            'circle-color': [
                'match',
                ['get', 'Primary_Contaminant_Category'],
                ...Object.entries(categoryColors).flat(),
                '#444' // Fallback
            ]
        }
    });

    // LAYER 2: The Core (The actual dots)
    // Smaller radius, solid color, NO OUTLINE (stroke-width: 0)
    map.addLayer({
        id: 'sites-core',
        type: 'circle',
        source: 'superfund-sites',
        paint: {
            'circle-radius': 4,
            'circle-stroke-width': 0, // Removed black outline
            'circle-color': [
                'match',
                ['get', 'Primary_Contaminant_Category'],
                ...Object.entries(categoryColors).flat(),
                '#fff'
            ]
        }
    });

    // Initialize UI and Interactions
    createFilterUI();
    setupInteractions();
});

// --- UI FUNCTIONS ---

function createFilterUI() {
    const container = document.getElementById('category-filters');
    
    Object.keys(categoryColors).forEach(cat => {
        const row = document.createElement('div');
        row.className = 'filter-row';
        
        // Colored indicator
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = categoryColors[cat];
        dot.style.boxShadow = `0 0 6px ${categoryColors[cat]}`; // Glow in sidebar too
        
        // Checkbox
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = true;
        input.id = `filter-${cat}`;
        input.addEventListener('change', updateFilters);
        
        // Label
        const label = document.createElement('label');
        label.htmlFor = `filter-${cat}`;
        label.innerText = cat;
        
        row.appendChild(input);
        row.appendChild(dot);
        row.appendChild(label);
        container.appendChild(row);
    });
    
    // Bookmark toggle listener
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if (bookmarkToggle) {
        bookmarkToggle.addEventListener('change', updateFilters);
    }
}

function updateFilters() {
    // 1. Get enabled categories
    const checkedCategories = Object.keys(categoryColors).filter(cat => {
        return document.getElementById(`filter-${cat}`).checked;
    });

    // 2. Base Filter: Category must be in checked list
    let filter = ['in', ['get', 'Primary_Contaminant_Category'], ['literal', checkedCategories]];

    // 3. Bookmark Filter: If toggle is on, ID must also be in bookmarks
    if (document.getElementById('show-bookmarks').checked) {
        const bookmarkFilter = ['in', ['get', 'Site_EPA_ID'], ['literal', bookmarks]];
        filter = ['all', filter, bookmarkFilter];
    }

    // 4. Apply to BOTH layers (Glow and Core)
    if (map.getLayer('sites-core')) map.setFilter('sites-core', filter);
    if (map.getLayer('sites-glow')) map.setFilter('sites-glow', filter);
}

// --- INTERACTION FUNCTIONS ---

function setupInteractions() {
    // Click event on the "core" layer
    map.on('click', 'sites-core', (e) => {
        const props = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const siteId = props.Site_EPA_ID;
        
        // Determine Bookmark State
        const isBookmarked = bookmarks.includes(siteId);
        const btnText = isBookmarked ? '★ TRACKED' : '☆ TRACK SITE';
        const btnClass = isBookmarked ? 'active' : '';

        // Contaminant list or fallback
        const contaminationText = props.Contaminants_List || props.Primary_Contaminant_Category;

        // Popup HTML
        const html = `
            <div class="popup-title">${props.Site_Name}</div>
            <div class="popup-meta">${props.City}, ${props.State}</div>
            <div class="popup-contaminants">
                <strong>DETECTED:</strong><br>
                ${contaminationText}
            </div>
            <button class="bookmark-btn ${btnClass}" onclick="toggleBookmark('${siteId}')" id="btn-${siteId}">
                ${btnText}
            </button>
        `;

        // Create Popup
        new mapboxgl.Popup({ className: 'dark-popup' })
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
    });

    // Hover cursors
    map.on('mouseenter', 'sites-core', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'sites-core', () => map.getCanvas().style.cursor = '');
}

// --- GLOBAL HELPERS (Accessible by HTML) ---

window.toggleBookmark = function(siteId) {
    const index = bookmarks.indexOf(siteId);
    const btn = document.getElementById(`btn-${siteId}`);
    
    if (index === -1) {
        // Add
        bookmarks.push(siteId);
        if (btn) {
            btn.innerText = '★ TRACKED';
            btn.classList.add('active');
        }
    } else {
        // Remove
        bookmarks.splice(index, 1);
        if (btn) {
            btn.innerText = '☆ TRACK SITE';
            btn.classList.remove('active');
        }
    }
    
    // Save to LocalStorage
    localStorage.setItem('superfundBookmarks', JSON.stringify(bookmarks));
    
    // Refresh map if filter is active
    if (document.getElementById('show-bookmarks').checked) {
        updateFilters();
    }
};