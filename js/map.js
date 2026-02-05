// --- CONFIGURATION ---
// REPLACE WITH YOUR TOKEN
mapboxgl.accessToken = 'pk.eyJ1IjoianVsaW92aWVqbyIsImEiOiJja2Y3NHBtM2gwd3M2MnNydmIxYjYxa2lvIn0.puI9pJXRVKcgpBONE8cYXA';

const categoryColors = {
    'Radioactive': '#FF3333',
    'Dioxins & Furans': '#D000D0',
    'Explosives': '#FF9900',
    'PCBs': '#FF5500',
    'Pesticides': '#00FF00',
    'Metals': '#00CCFF',
    'VOCs': '#3366FF',
    'SVOCs': '#6633FF',
    'Asbestos': '#FFFFFF',
    'Cyanides': '#00FFFF',
    'Other': '#FFFF00',
    'Unknown': '#444444'
};

// --- STATE MANAGEMENT ---
let bookmarks = JSON.parse(localStorage.getItem('superfundBookmarks')) || [];
let siteData = null;       // Will hold the full GeoJSON
let currentSearchIDs = null; // Null means "no search active"

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-98.5795, 39.8283],
    zoom: 3.5,
    projection: 'globe' 
});

// --- LOAD EVENTS ---

map.on('style.load', () => {
    map.setBackgroundColor('rgba(0,0,0,0)');
    map.setFog({
        'color': 'rgba(0,0,0,0)',
        'high-color': 'rgba(0,0,0,0)',
        'horizon-blend': 0,
        'space-color': 'rgba(0,0,0,0)',
        'star-intensity': 0
    });
});

map.on('load', () => {
    // 1. Fetch Data Manually so we can search it
    fetch('data/superfund_sites.json')
        .then(response => response.json())
        .then(data => {
            siteData = data; // Save to global variable for search

            // 2. Add Source
            map.addSource('superfund-sites', {
                type: 'geojson',
                data: siteData
            });

            // 3. Add Layers
            addLayers();

            // 4. Init UI
            createFilterUI();
            initSearch();
            setupInteractions();
        })
        .catch(error => console.error("Error loading JSON:", error));
});

function addLayers() {
    // LAYER: Glow
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

    // LAYER: Core
    map.addLayer({
        id: 'sites-core',
        type: 'circle',
        source: 'superfund-sites',
        paint: {
            'circle-radius': 3.5,
            'circle-stroke-width': 0,
            'circle-color': [
                'match',
                ['get', 'Primary_Contaminant_Category'],
                ...Object.entries(categoryColors).flat(),
                '#fff'
            ]
        }
    });
}

// --- SEARCH LOGIC ---

function initSearch() {
    const searchInput = document.getElementById('site-search');
    if(!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();

        if (term === '') {
            currentSearchIDs = null; // Clear search filter
        } else {
            // Filter the actual data in memory
            const matches = siteData.features.filter(feature => {
                const props = feature.properties;
                // Check Name, City, and State
                return (props.Site_Name && props.Site_Name.toLowerCase().includes(term)) ||
                       (props.City && props.City.toLowerCase().includes(term)) ||
                       (props.State && props.State.toLowerCase().includes(term));
            });

            // Extract just the IDs
            currentSearchIDs = matches.map(f => f.properties.Site_EPA_ID);
        }

        updateFilters();
    });
}

// --- FILTER UI ---

function createFilterUI() {
    const container = document.getElementById('category-filters');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(categoryColors).forEach(cat => {
        const row = document.createElement('div');
        row.className = 'filter-row';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = true;
        input.id = `filter-${cat}`;
        input.addEventListener('change', updateFilters);
        
        const dot = document.createElement('span');
        dot.className = 'color-dot';
        dot.style.backgroundColor = categoryColors[cat];
        dot.style.boxShadow = `0 0 5px ${categoryColors[cat]}`;
        
        const label = document.createElement('label');
        label.htmlFor = `filter-${cat}`;
        label.innerText = cat;
        
        row.appendChild(input);
        row.appendChild(dot);
        row.appendChild(label);
        container.appendChild(row);
    });
    
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if(bookmarkToggle) bookmarkToggle.addEventListener('change', updateFilters);
}

// --- APPLY FILTERS ---

function updateFilters() {
    // 1. Get Checked Categories
    const checkedCategories = Object.keys(categoryColors).filter(cat => {
        const el = document.getElementById(`filter-${cat}`);
        return el && el.checked;
    });

    // Start with Category Filter
    let conditions = [];
    conditions.push(['in', ['get', 'Primary_Contaminant_Category'], ['literal', checkedCategories]]);

    // 2. Add Bookmark Filter (if active)
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if (bookmarkToggle && bookmarkToggle.checked) {
        conditions.push(['in', ['get', 'Site_EPA_ID'], ['literal', bookmarks]]);
    }

    // 3. Add Search Filter (if active)
    if (currentSearchIDs !== null) {
        conditions.push(['in', ['get', 'Site_EPA_ID'], ['literal', currentSearchIDs]]);
    }

    // Combine all filters with "all" (AND logic)
    const finalFilter = ['all', ...conditions];

    // Apply to map layers
    if (map.getLayer('sites-core')) map.setFilter('sites-core', finalFilter);
    if (map.getLayer('sites-glow')) map.setFilter('sites-glow', finalFilter);
}

// --- INTERACTIONS ---

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

    map.on('mouseenter', 'sites-core', () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', 'sites-core', () => map.getCanvas().style.cursor = '');
}

window.toggleBookmark = function(siteId) {
    const index = bookmarks.indexOf(siteId);
    const btn = document.getElementById(`btn-${siteId}`);
    
    if (index === -1) {
        bookmarks.push(siteId);
        if(btn) { btn.innerText = '★ TRACKED'; btn.classList.add('active'); }
    } else {
        bookmarks.splice(index, 1);
        if(btn) { btn.innerText = '☆ TRACK SITE'; btn.classList.remove('active'); }
    }
    
    localStorage.setItem('superfundBookmarks', JSON.stringify(bookmarks));
    
    const bookmarkToggle = document.getElementById('show-bookmarks');
    if (bookmarkToggle && bookmarkToggle.checked) updateFilters();
};