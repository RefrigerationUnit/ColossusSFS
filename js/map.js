// --- CONFIGURATION ---
// REPLACE WITH YOUR TOKEN
mapboxgl.accessToken = 'pk.eyJ1IjoianVsaW92aWVqbyIsImEiOiJja2Y3NHBtM2gwd3M2MnNydmIxYjYxa2lvIn0.puI9pJXRVKcgpBONE8cYXA';


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

let bookmarks = JSON.parse(localStorage.getItem('superfundBookmarks')) || [];

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-98.5795, 39.8283],
    zoom: 3.5,
    projection: 'globe' 
});

// --- LOAD EVENTS ---

map.on('style.load', () => {
    // 1. Make Map Transparent (for Starfield Background)
    map.setBackgroundColor('rgba(0,0,0,0)');
    
    // 2. Remove Atmosphere/Fog (Transparency Fix)
    map.setFog({
        'color': 'rgba(0,0,0,0)',
        'high-color': 'rgba(0,0,0,0)',
        'horizon-blend': 0,
        'space-color': 'rgba(0,0,0,0)',
        'star-intensity': 0
    });
});

map.on('load', () => {
    // 3. Add Data Source
    map.addSource('superfund-sites', {
        type: 'geojson',
        data: 'data/superfund_sites.json'
    });

    // 4. LAYER: Glow (Background)
    map.addLayer({
        id: 'sites-glow',
        type: 'circle',
        source: 'superfund-sites',
        paint: {
            'circle-radius': 10,
            'circle-blur': 1,
            'circle-opacity': 0.5,
            'circle-color': [
                'match',
                ['get', 'Primary_Contaminant_Category'],
                ...Object.entries(categoryColors).flat(),
                '#444'
            ]
        }
    });

    // 5. LAYER: Core (Foreground Dot)
    map.addLayer({
        id: 'sites-core',
        type: 'circle',
        source: 'superfund-sites',
        paint: {
            'circle-radius': 3.5,
            'circle-stroke-width': 0, // No Outline
            'circle-color': [
                'match',
                ['get', 'Primary_Contaminant_Category'],
                ...Object.entries(categoryColors).flat(),
                '#fff'
            ]
        }
    });

    // 6. Init UI
    createFilterUI();
    setupInteractions();
});

// --- UI GENERATION ---

function createFilterUI() {
    const container = document.getElementById('category-filters');
    
    if (!container) {
        console.error("Legend container 'category-filters' not found in HTML!");
        return;
    }

    // Clear existing (just in case)
    container.innerHTML = '';

    Object.keys(categoryColors).forEach(cat => {
        const row = document.createElement('div');
        row.className = 'filter-row';
        
        // 1. Checkbox
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = true;
        input.id = `filter-${cat}`;
        input.addEventListener('change', updateFilters);
        
        // 2. Color Dot
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = categoryColors[cat];
        dot.style.boxShadow = `0 0 5px ${categoryColors[cat]}`;
        
        // 3. Label
        const label = document.createElement('label');
        label.htmlFor = `filter-${cat}`;
        label.innerText = cat;
        
        row.appendChild(input);
        row.appendChild(dot);
        row.appendChild(label);
        container.appendChild(row);
    });
    
    // Bookmark Listener
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if(bookmarkToggle) {
        bookmarkToggle.addEventListener('change', updateFilters);
    }
}

// --- FILTER LOGIC ---

function updateFilters() {
    // Get all checked categories
    const checkedCategories = Object.keys(categoryColors).filter(cat => {
        const el = document.getElementById(`filter-${cat}`);
        return el && el.checked;
    });

    // Base Filter
    let filter = ['in', ['get', 'Primary_Contaminant_Category'], ['literal', checkedCategories]];

    // Bookmark Filter
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if (bookmarkToggle && bookmarkToggle.checked) {
        const bookmarkFilter = ['in', ['get', 'Site_EPA_ID'], ['literal', bookmarks]];
        filter = ['all', filter, bookmarkFilter];
    }

    // Apply to layers
    if (map.getLayer('sites-core')) map.setFilter('sites-core', filter);
    if (map.getLayer('sites-glow')) map.setFilter('sites-glow', filter);
}

// --- INTERACTION LOGIC ---

function setupInteractions() {
    map.on('click', 'sites-core', (e) => {
        const props = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const siteId = props.Site_EPA_ID;
        
        const isBookmarked = bookmarks.includes(siteId);
        const btnText = isBookmarked ? '★ TRACKED' : '☆ TRACK SITE';
        const btnClass = isBookmarked ? 'active' : '';

        const contaminationText = props.Contaminants_List || props.Primary_Contaminant_Category;

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

        new mapboxgl.Popup({ className: 'dark-popup' })
            .setLngLat(coordinates)
            .setHTML(html)
            .addTo(map);
    });

    // Cursor Pointers
    map.on('mouseenter', 'sites-core', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'sites-core', () => map.getCanvas().style.cursor = '');
}

// --- GLOBAL HELPERS ---

window.toggleBookmark = function(siteId) {
    const index = bookmarks.indexOf(siteId);
    const btn = document.getElementById(`btn-${siteId}`);
    
    if (index === -1) {
        bookmarks.push(siteId);
        if(btn) {
            btn.innerText = '★ TRACKED';
            btn.classList.add('active');
        }
    } else {
        bookmarks.splice(index, 1);
        if(btn) {
            btn.innerText = '☆ TRACK SITE';
            btn.classList.remove('active');
        }
    }
    
    localStorage.setItem('superfundBookmarks', JSON.stringify(bookmarks));
    
    // Refresh filters if showing bookmarks
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if (bookmarkToggle && bookmarkToggle.checked) {
        updateFilters();
    }
};