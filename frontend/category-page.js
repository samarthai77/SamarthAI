(() => {
    'use strict';

    const SERVICE_API_URL = 'https://samarthai-backend.onrender.com/api/services';
    if (new URLSearchParams(window.location.search).get('category') === 'home-services') {
        document.title = 'Home Services — SamarthAI Kavach';
        initializeHomeServices();
        return;
    }
    const categoryPages = [
        {
            id: 'home',
            name: 'Home Services',
            eyebrow: 'Reliable help for home and everyday repairs',
            description: 'Find local help for plumbing, electrical work, cleaning, pest control, appliance care and home maintenance.',
            aliases: ['home services', 'home service', 'plumber', 'plumbers', 'plumbing', 'electrician', 'electricians', 'home cleaning', 'house cleaning', 'cleaning', 'pest control', 'ac repair', 'air conditioning', 'carpenter', 'carpentry', 'painter', 'painting', 'gardening', 'handyman', 'home repair'],
            photo: {
                id: 32588548,
                author: 'Bulat843',
                source: 'https://www.pexels.com/photo/plumber-repairing-pipe-with-wrench-indoors-32588548/',
                alt: 'A plumber repairing a pipe with a wrench'
            },
            quick: ['Plumber', 'Electrician', 'Home Cleaning', 'AC Repair'],
            subcategories: [
                { name: 'Plumber', description: 'Pipes, taps, drains and water fittings', terms: ['plumber', 'plumbers', 'plumbing', 'pipe fitting', 'drain repair', 'tap repair'] },
                { name: 'Electrician', description: 'Wiring, switches, lights and installations', terms: ['electrician', 'electricians', 'electrical', 'wiring', 'switch repair'] },
                { name: 'Home Cleaning', description: 'Home, kitchen and deep-cleaning help', terms: ['home cleaning', 'house cleaning', 'cleaning', 'cleaner', 'maid service', 'deep cleaning'] },
                { name: 'Pest Control', description: 'Pest inspection and treatment services', terms: ['pest control', 'pest', 'exterminator', 'extermination', 'termite control'] },
                { name: 'AC Repair', description: 'Air-conditioner service, repair and upkeep', terms: ['ac repair', 'air conditioner', 'air conditioning', 'hvac', 'ac service', 'ac fridge'] },
                { name: 'Carpenter', description: 'Furniture, woodwork, doors and fittings', terms: ['carpenter', 'carpentry', 'woodwork', 'furniture repair'] },
                { name: 'Painter', description: 'Interior, exterior and wall painting', terms: ['painter', 'painting', 'wall paint', 'house painting'] },
                { name: 'Gardening', description: 'Garden care, planting and landscaping', terms: ['gardening', 'gardener', 'garden', 'landscaping', 'lawn care'] },
                { name: 'Home Repair', description: 'Handyman and household maintenance', terms: ['home repair', 'handyman', 'home maintenance', 'household repair'] }
            ]
        },
        {
            id: 'food',
            name: 'Food & Sweets',
            eyebrow: 'Local kitchens, restaurants and mithai',
            description: 'Browse local restaurants, bakeries, tiffin services, caterers and sweet shops using current community listings.',
            aliases: ['food and sweets', 'food', 'sweet', 'sweets', 'mithai', 'restaurant', 'restaurants', 'bakery', 'catering', 'tiffin', 'dhaba', 'cafe', 'snacks'],
            photo: {
                id: 32083371,
                author: 'Valeria Boltneva',
                source: 'https://www.pexels.com/photo/delicious-indian-cuisine-platter-with-variety-dishes-32083371/',
                alt: 'A platter of Indian dishes served together'
            },
            quick: ['Restaurants', 'Sweets & Mithai', 'Bakery', 'Tiffin Service'],
            subcategories: [
                { name: 'Restaurants', description: 'Local restaurants and dining options', terms: ['restaurant', 'restaurants', 'dining', 'eatery'] },
                { name: 'Sweets & Mithai', description: 'Traditional mithai and dessert shops', terms: ['sweet', 'sweets', 'mithai', 'dessert', 'desserts'] },
                { name: 'Bakery', description: 'Breads, cakes and baked goods', terms: ['bakery', 'baker', 'cake', 'cakes', 'bread'] },
                { name: 'Catering', description: 'Food service for gatherings and events', terms: ['catering', 'caterer', 'caterers'] },
                { name: 'Tiffin Service', description: 'Meal and tiffin delivery services', terms: ['tiffin', 'meal service', 'home cooked meals'] },
                { name: 'Street Food & Snacks', description: 'Snacks, stalls and local favourites', terms: ['street food', 'snacks', 'snack', 'chaat'] },
                { name: 'Dhabas', description: 'Casual local food and dhaba listings', terms: ['dhaba', 'dhabas'] },
                { name: 'Cafes', description: 'Coffee, tea and cafe listings', terms: ['cafe', 'cafes', 'coffee shop'] }
            ]
        },
        {
            id: 'travel',
            name: 'Travel & Hotels',
            eyebrow: 'Stay planning and local travel support',
            description: 'Explore accommodation, homestays, travel agents and trip services listed by the local community.',
            aliases: ['travel and hotels', 'travel', 'hotel', 'hotels', 'lodging', 'stay', 'stays', 'homestay', 'resort', 'tour', 'tourism', 'travel agent', 'holiday'],
            photo: {
                id: 5860693,
                author: 'Vinod C',
                source: 'https://www.pexels.com/photo/photo-of-a-hotel-luxury-room-interior-5860693/',
                alt: 'A hotel suite with a modern interior and city view'
            },
            quick: ['Hotels', 'Homestays', 'Travel Agents', 'Tour Packages'],
            subcategories: [
                { name: 'Hotels', description: 'Hotel and guest-room listings', terms: ['hotel', 'hotels', 'guest house', 'guesthouse'] },
                { name: 'Homestays', description: 'Home-style stays and guest homes', terms: ['homestay', 'homestays', 'home stay', 'guest home'] },
                { name: 'Travel Agents', description: 'Local travel planning and agent services', terms: ['travel agent', 'travel agents', 'tour operator'] },
                { name: 'Tour Packages', description: 'Tours, trips and guided experiences', terms: ['tour package', 'tour packages', 'guided tour', 'sightseeing'] },
                { name: 'Resorts', description: 'Resorts and leisure stays', terms: ['resort', 'resorts'] },
                { name: 'Holiday Stays', description: 'Vacation rentals and short stays', terms: ['holiday stay', 'vacation rental', 'short stay'] }
            ]
        },
        {
            id: 'transport',
            name: 'Cab & Transport',
            eyebrow: 'Local rides and goods movement',
            description: 'Find cab, taxi, driver, rental and goods-transport listings available in your selected city.',
            aliases: ['cab and transport', 'cab', 'cabs', 'taxi', 'taxis', 'transport', 'driver', 'drivers', 'car rental', 'vehicle rental', 'packers and movers', 'goods transport', 'logistics'],
            photo: {
                id: 5835281,
                author: 'Tim Samuel',
                source: 'https://www.pexels.com/photo/taxi-driver-in-car-riding-on-road-5835281/',
                alt: 'A taxi driving along a city road'
            },
            quick: ['Cabs', 'Airport Taxi', 'Car Rental', 'Goods Transport'],
            subcategories: [
                { name: 'Cabs', description: 'Local cab and taxi services', terms: ['cab', 'cabs', 'taxi', 'taxis'] },
                { name: 'Airport Taxi', description: 'Airport pickup and drop listings', terms: ['airport taxi', 'airport transfer', 'airport cab'] },
                { name: 'Outstation Rides', description: 'Intercity and outstation journeys', terms: ['outstation', 'intercity cab', 'city to city'] },
                { name: 'Car Rental', description: 'Self-drive and chauffeur car rentals', terms: ['car rental', 'car hire', 'vehicle rental'] },
                { name: 'Drivers', description: 'Local and trip drivers', terms: ['driver', 'drivers', 'chauffeur'] },
                { name: 'Packers & Movers', description: 'Household moving and packing listings', terms: ['packers', 'movers', 'packing and moving'] },
                { name: 'Goods Transport', description: 'Goods, cargo and local transport', terms: ['goods transport', 'cargo', 'logistics', 'freight'] }
            ]
        },
        {
            id: 'shopping',
            name: 'Shopping',
            eyebrow: 'Discover shops and everyday essentials',
            description: 'Browse local retail, grocery, fashion, electronics and home-essential listings. Product availability is shown only when provided by a listing.',
            aliases: ['shopping', 'shop', 'shops', 'retail', 'grocery', 'groceries', 'market', 'clothing', 'fashion store', 'electronics store', 'home essentials'],
            photo: {
                id: 36730399,
                author: 'Vitaly Gariev',
                source: 'https://www.pexels.com/photo/women-shopping-for-fashionable-clothing-in-store-36730399/',
                alt: 'Customers browsing clothing in a fashion boutique'
            },
            quick: ['Grocery', 'Clothing', 'Electronics', 'Home Essentials'],
            subcategories: [
                { name: 'Grocery', description: 'Grocery stores and everyday food items', terms: ['grocery', 'groceries', 'supermarket', 'provisions'] },
                { name: 'Clothing & Fashion', description: 'Clothing, apparel and fashion retail', terms: ['clothing', 'apparel', 'fashion store', 'garments'] },
                { name: 'Electronics Stores', description: 'Retail listings for electronics and devices', terms: ['electronics store', 'electronic shop', 'device store'] },
                { name: 'Home Essentials', description: 'Household and home-use products', terms: ['home essentials', 'household goods', 'home store'] },
                { name: 'Gifts', description: 'Gift shops and occasion items', terms: ['gift shop', 'gifts', 'gift store'] },
                { name: 'Books & Stationery', description: 'Books, stationery and study supplies', terms: ['books', 'bookstore', 'stationery'] },
                { name: 'Local Markets', description: 'Local shops and neighbourhood retail', terms: ['local market', 'market', 'retail shop'] }
            ]
        },
        {
            id: 'beauty',
            name: 'Beauty & Events',
            eyebrow: 'Personal care and occasion services',
            description: 'Explore salons, makeup artists, photographers, decorators and event services from real local listings.',
            aliases: ['beauty and events', 'beauty', 'salon', 'spa', 'makeup', 'make up', 'parlour', 'parlor', 'event', 'events', 'wedding', 'photographer', 'decorator'],
            photo: {
                id: 33580449,
                author: 'Bulat843',
                source: 'https://www.pexels.com/photo/professional-makeup-artist-applying-makeup-on-client-33580449/',
                alt: 'A makeup artist working with a client in a salon'
            },
            quick: ['Salon & Spa', 'Makeup Artist', 'Photographers', 'Event Planners'],
            subcategories: [
                { name: 'Salon & Spa', description: 'Salon, spa and personal-care listings', terms: ['salon', 'spa', 'beauty parlour', 'beauty parlor'] },
                { name: 'Makeup Artist', description: 'Makeup services for occasions and events', terms: ['makeup artist', 'make up artist', 'makeup', 'bridal makeup'] },
                { name: 'Bridal Services', description: 'Bridal beauty and preparation services', terms: ['bridal service', 'bridal makeup', 'bridal beauty'] },
                { name: 'Photographers', description: 'Photography for events and portraits', terms: ['photographer', 'photographers', 'photography'] },
                { name: 'Event Planners', description: 'Planning and coordination for events', terms: ['event planner', 'event planners', 'event management'] },
                { name: 'Decorators', description: 'Venue and occasion decoration listings', terms: ['decorator', 'decorators', 'event decor', 'wedding decor'] },
                { name: 'Mehendi Artists', description: 'Mehendi and henna artist listings', terms: ['mehendi', 'henna artist', 'mehndi'] }
            ]
        },
        {
            id: 'construction',
            name: 'Construction',
            eyebrow: 'Building, interiors and renovation',
            description: 'Find construction, civil work, contractor, interior and renovation listings posted to the marketplace.',
            aliases: ['construction', 'building', 'contractor', 'contractors', 'renovation', 'civil work', 'masonry', 'architect', 'architecture', 'interior design', 'flooring', 'tiling'],
            photo: {
                id: 10202865,
                author: 'This Viktọ',
                source: 'https://www.pexels.com/photo/construction-workers-on-the-building-site-10202865/',
                alt: 'Construction workers at an active building site'
            },
            quick: ['Contractors', 'Civil Work', 'Interiors', 'Renovation'],
            subcategories: [
                { name: 'Contractors', description: 'Construction and project contractors', terms: ['contractor', 'contractors', 'construction company'] },
                { name: 'Civil Work', description: 'Civil construction and structural work', terms: ['civil work', 'civil contractor', 'structural work'] },
                { name: 'Architects', description: 'Architecture and design professionals', terms: ['architect', 'architects', 'architecture'] },
                { name: 'Interior Design', description: 'Interior planning and fit-out services', terms: ['interior design', 'interior designer', 'interiors'] },
                { name: 'Renovation', description: 'Home and building renovation listings', terms: ['renovation', 'renovations', 'remodelling', 'remodeling'] },
                { name: 'Masonry', description: 'Masonry, brickwork and plaster services', terms: ['mason', 'masonry', 'brickwork', 'plastering'] },
                { name: 'Flooring & Tiling', description: 'Floor and tile installation work', terms: ['flooring', 'tiling', 'tile work', 'floor tiles'] },
                { name: 'Waterproofing', description: 'Roof, wall and building waterproofing', terms: ['waterproofing', 'water proofing', 'roof sealing'] }
            ]
        },
        {
            id: 'repair',
            name: 'Repair & Electronics',
            eyebrow: 'Device, appliance and technical repairs',
            description: 'Browse available repair technicians for electronics, computers, phones and household appliances.',
            aliases: ['repair and electronics', 'repair', 'electronics', 'electronic repair', 'mobile repair', 'computer repair', 'laptop repair', 'appliance repair', 'refrigerator repair', 'washing machine repair', 'tv repair', 'ac fridge', 'ac and fridge', 'technician', 'mechanic'],
            photo: {
                id: 36861987,
                author: 'Bulat843',
                source: 'https://www.pexels.com/photo/technician-repairing-computer-circuit-board-36861987/',
                alt: 'A technician repairing a computer circuit board'
            },
            quick: ['Computer Repair', 'Mobile Repair', 'Appliance Repair', 'Technician'],
            subcategories: [
                { name: 'Computer Repair', description: 'Computer, desktop and laptop repair', terms: ['computer repair', 'laptop repair', 'desktop repair'] },
                { name: 'Mobile Repair', description: 'Phone and mobile-device repair', terms: ['mobile repair', 'phone repair', 'smartphone repair'] },
                { name: 'Appliance Repair', description: 'Household appliance repair services', terms: ['appliance repair', 'washing machine repair', 'refrigerator repair', 'fridge repair', 'ac fridge'] },
                { name: 'TV & Audio Repair', description: 'Television and audio-device repair', terms: ['tv repair', 'television repair', 'audio repair'] },
                { name: 'Electronics Repair', description: 'Electronic equipment and device repairs', terms: ['electronics repair', 'electronic repair', 'circuit board repair'] },
                { name: 'Technicians', description: 'Technical support and equipment service', terms: ['technician', 'technicians', 'technical support'] },
                { name: 'Vehicle Repair', description: 'Vehicle and mechanic listings', terms: ['vehicle repair', 'mechanic', 'auto repair', 'car repair'] }
            ]
        }
    ];

    const elements = {
        title: document.getElementById('categoryTitle'),
        eyebrow: document.getElementById('categoryEyebrow'),
        description: document.getElementById('categoryDescription'),
        breadcrumb: document.getElementById('categoryBreadcrumb'),
        photoFrame: document.getElementById('categoryPhotoFrame'),
        photo: document.getElementById('categoryHeroImage'),
        photoFallback: document.getElementById('categoryPhotoFallback'),
        photoFallbackMark: document.getElementById('categoryPhotoFallbackMark'),
        photoFallbackTitle: document.getElementById('categoryPhotoFallbackTitle'),
        photoCaption: document.getElementById('categoryPhotoCaption'),
        photoCredit: document.getElementById('categoryPhotoCredit'),
        searchForm: document.getElementById('categorySearchForm'),
        search: document.getElementById('categorySearchInput'),
        quickLinks: document.getElementById('categoryQuickLinks'),
        nearby: document.getElementById('categoryNearbyButton'),
        cityButton: document.getElementById('categoryCityButton'),
        cityWrap: document.getElementById('categoryCityWrap'),
        citySelect: document.getElementById('categoryCitySelect'),
        locationStatus: document.getElementById('categoryLocationStatus'),
        subcategoryGrid: document.getElementById('subcategoryGrid'),
        viewAll: document.getElementById('viewAllSubcategories'),
        resultCount: document.getElementById('categoryResultCount'),
        state: document.getElementById('categoryListingsState'),
        listingGrid: document.getElementById('categoryListingGrid'),
        listingContext: document.getElementById('listingContext'),
        relatedGrid: document.getElementById('relatedCategoryGrid'),
        menuToggle: document.getElementById('categoryMenuToggle'),
        nav: document.getElementById('categoryNav')
    };

    const pageId = new URLSearchParams(window.location.search).get('category');
    const page = categoryPages.find(candidate => candidate.id === pageId) || categoryPages[0];
    const state = {
        allServices: [],
        load: 'loading',
        search: new URLSearchParams(window.location.search).get('q') || '',
        selectedSubcategory: null,
        expandedSubcategories: false,
        locationMode: '',
        city: '',
        coordinates: null,
        nearbyError: ''
    };

    function normalize(value) {
        return String(value || '')
            .normalize('NFKC')
            .toLocaleLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[/_-]+/g, ' ')
            .replace(/[^\p{L}\p{N}]+/gu, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function phraseMatches(value, phrase) {
        const haystack = ` ${normalize(value)} `;
        const needle = ` ${normalize(phrase)} `;
        return needle.length > 2 && haystack.includes(needle);
    }

    function categoryForValue(value) {
        const categoryText = normalize(value);
        return categoryPages.find(candidate => candidate.aliases.some(alias => phraseMatches(categoryText, alias))) || null;
    }

    function serviceFields(service, includeLocation = true) {
        const user = Array.isArray(service.users) ? service.users[0] : service.users;
        const fields = [service.title, service.description, service.category, user && user.name, service.provider_name];
        if (includeLocation) fields.push(service.location);
        return fields.filter(Boolean).join(' ');
    }

    function subcategoryMatchesService(service, subcategory) {
        const fields = [service.title, service.description, service.category].filter(Boolean).join(' ');
        return subcategory.terms.some(term => phraseMatches(fields, term));
    }

    function serviceBelongsToPage(service) {
        const explicitCategory = categoryForValue(service.category);
        if (explicitCategory && explicitCategory.id === page.id) return true;
        if (page.subcategories.some(subcategory => subcategoryMatchesService(service, subcategory))) return true;
        if (explicitCategory) return false;
        return page.aliases.some(alias => phraseMatches(service.title, alias));
    }

    function getPageServices() {
        return state.allServices.filter(service => service && typeof service === 'object' && serviceBelongsToPage(service));
    }

    function matchesSearch(service) {
        const query = normalize(state.search);
        if (!query) return true;
        const words = query.split(' ').filter(Boolean);
        const listingWords = normalize(serviceFields(service)).split(' ').filter(Boolean);
        return words.every(word => listingWords.some(candidate =>
            candidate === word || (word.length > 3 && candidate.startsWith(word))
        ));
    }

    function getServiceCoordinates(service) {
        const latitude = Number(service.latitude);
        const longitude = Number(service.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
        return { latitude, longitude };
    }

    function distanceKm(first, second) {
        const radians = value => value * Math.PI / 180;
        const deltaLatitude = radians(second.latitude - first.latitude);
        const deltaLongitude = radians(second.longitude - first.longitude);
        const value = Math.sin(deltaLatitude / 2) ** 2 +
            Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) *
            Math.sin(deltaLongitude / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    }

    function getLocations() {
        const locations = new Map();
        getPageServices().forEach(service => {
            const location = typeof service.location === 'string' ? service.location.trim() : '';
            if (location) locations.set(normalize(location), location);
        });
        return Array.from(locations, ([key, label]) => ({ key, label }))
            .sort((first, second) => first.label.localeCompare(second.label));
    }

    function updateLocationControls() {
        const locations = getLocations();
        const previousCity = state.city || elements.citySelect.value;
        elements.citySelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = locations.length ? 'Choose a listed city / area' : 'No listed cities yet';
        elements.citySelect.appendChild(placeholder);
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location.key;
            option.textContent = location.label;
            elements.citySelect.appendChild(option);
        });

        const hasPreviousCity = locations.some(location => location.key === previousCity);
        state.city = hasPreviousCity ? previousCity : '';
        elements.citySelect.value = state.city;
        elements.citySelect.disabled = !locations.length;
        elements.cityWrap.hidden = state.locationMode !== 'preferred-city';
        elements.nearby.setAttribute('aria-pressed', String(state.locationMode === 'nearby'));
        elements.cityButton.setAttribute('aria-pressed', String(state.locationMode === 'preferred-city'));
        elements.nearby.disabled = !navigator.geolocation || !getPageServices().some(service => getServiceCoordinates(service));

        if (state.locationMode === 'preferred-city') {
            elements.locationStatus.textContent = locations.length
                ? (state.city ? `Showing active listings in ${locations.find(location => location.key === state.city).label}.` : 'Choose a city from active listings. Your service filter stays selected.')
                : 'No city values are available in this category’s active listings.';
        } else if (state.locationMode === 'nearby') {
            elements.locationStatus.textContent = state.nearbyError || 'Nearby results use device location and listing coordinates when both are available.';
        } else {
            elements.locationStatus.textContent = locations.length
                ? 'Choose Nearby Services or a city from active listings.'
                : 'City options will appear when active listings include a location.';
        }
    }

    function makeImageUrl(width) {
        return `assets/category-images/${page.id}-${width}.jpg`;
    }

    function setPhotoSource(photo, useFallback = false) {
        elements.photo.onerror = () => {
            if (!useFallback) {
                setPhotoSource(photo, true);
                return;
            }
            elements.photo.hidden = true;
            elements.photoFallback.hidden = false;
        };
        elements.photo.onload = () => {
            elements.photo.hidden = false;
            elements.photoFallback.hidden = true;
            elements.photo.dataset.rendered = 'true';
            elements.photo.dataset.sourceState = useFallback ? 'fallback-loaded' : 'primary-loaded';
        };
        elements.photo.dataset.rendered = 'false';
        elements.photo.dataset.sourceState = useFallback ? 'fallback-loading' : 'primary-loading';
        elements.photo.alt = photo.alt;
        elements.photo.srcset = useFallback ? '' : `${makeImageUrl(640)} 640w, ${makeImageUrl(1280)} 1280w`;
        elements.photo.sizes = '(max-width: 700px) calc(100vw - 24px), (max-width: 1100px) 40vw, 500px';
        elements.photo.src = makeImageUrl(useFallback ? 640 : 1280);
        elements.photoCredit.href = photo.source;
        elements.photoCredit.textContent = `Photo by ${photo.author} · Pexels`;
        elements.photoFallbackMark.textContent = page.name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
        elements.photoFallbackTitle.textContent = page.name;
        elements.photoCaption.textContent = `${page.name} · category photo`;
    }

    function renderPage() {
        document.title = `${page.name} — SamarthAI Kavach`;
        elements.title.textContent = page.name;
        elements.eyebrow.textContent = `SAMARTHAI KAVACH · ${page.eyebrow.toLocaleUpperCase()}`;
        elements.description.textContent = page.description;
        elements.breadcrumb.textContent = page.name;
        elements.listingContext.textContent = `Only active ${page.name.toLocaleLowerCase()} listings returned by the service API appear here.`;
        elements.search.placeholder = `Search ${page.name.toLocaleLowerCase()}…`;
        elements.search.value = state.search;
        setPhotoSource(page.photo);
        renderQuickLinks();
        renderSubcategories();
        renderRelatedCategories();
    }

    function findSubcategory(query) {
        const normalizedQuery = normalize(query);
        if (!normalizedQuery) return null;
        return page.subcategories.find(subcategory =>
            [subcategory.name, ...subcategory.terms].some(term => normalize(term) === normalizedQuery)
        ) || null;
    }

    function selectSubcategory(subcategory) {
        state.selectedSubcategory = subcategory;
        state.search = subcategory.name;
        elements.search.value = subcategory.name;
        renderSubcategories();
        renderQuickLinks();
        renderListings();
        document.getElementById('categoryListings').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function createSubcategoryCard(subcategory) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'subcategory-card';
        button.setAttribute('aria-pressed', String(state.selectedSubcategory?.name === subcategory.name));
        const eyebrow = document.createElement('span');
        eyebrow.className = 'subcategory-card__eyebrow';
        eyebrow.textContent = page.name;
        const title = document.createElement('strong');
        title.textContent = subcategory.name;
        const description = document.createElement('small');
        description.textContent = subcategory.description;
        const arrow = document.createElement('span');
        arrow.className = 'subcategory-card__arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        button.append(eyebrow, title, description, arrow);
        button.addEventListener('click', () => selectSubcategory(subcategory));
        return button;
    }

    function renderSubcategories() {
        elements.subcategoryGrid.replaceChildren();
        const visibleSubcategories = state.expandedSubcategories
            ? page.subcategories
            : page.subcategories.slice(0, 6);
        visibleSubcategories.forEach(subcategory => elements.subcategoryGrid.appendChild(createSubcategoryCard(subcategory)));
        elements.viewAll.hidden = page.subcategories.length <= 6;
        elements.viewAll.textContent = state.expandedSubcategories ? `Show fewer ${page.name}` : `View All ${page.name}`;
        elements.viewAll.setAttribute('aria-expanded', String(state.expandedSubcategories));
    }

    function renderQuickLinks() {
        elements.quickLinks.replaceChildren();
        const label = document.createElement('span');
        label.className = 'category-quick-links__label';
        label.textContent = 'Popular:';
        elements.quickLinks.appendChild(label);
        page.quick.forEach(name => {
            const subcategory = page.subcategories.find(candidate => candidate.name === name) ||
                page.subcategories.find(candidate => candidate.terms.some(term => normalize(term) === normalize(name)));
            if (!subcategory) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'category-quick-link';
            button.textContent = name;
            button.setAttribute('aria-pressed', String(state.selectedSubcategory?.name === subcategory.name));
            button.addEventListener('click', () => selectSubcategory(subcategory));
            elements.quickLinks.appendChild(button);
        });
    }

    function renderRelatedCategories() {
        elements.relatedGrid.replaceChildren();
        const related = categoryPages.filter(candidate => candidate.id !== page.id).slice(0, 4);
        related.forEach(candidate => {
            const link = document.createElement('a');
            link.className = 'category-related-link';
            link.href = `category.html?category=${encodeURIComponent(candidate.id)}`;
            const label = document.createElement('span');
            label.textContent = candidate.name;
            const arrow = document.createElement('span');
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '→';
            link.append(label, arrow);
            elements.relatedGrid.appendChild(link);
        });
    }

    function providerFor(service) {
        const user = Array.isArray(service.users) ? service.users[0] : service.users;
        const candidates = [user && user.name, service.provider_name, service.providerName];
        const name = candidates.find(value => typeof value === 'string' && value.trim() && normalize(value) !== 'service provider');
        return {
            name: name ? name.trim() : '',
            phone: user && typeof user.phone === 'string' ? user.phone.trim() : (typeof service.phone === 'string' ? service.phone.trim() : ''),
            email: user && typeof user.email === 'string' ? user.email.trim() : (typeof service.email === 'string' ? service.email.trim() : '')
        };
    }

    function servicePrice(service) {
        if (service.price === null || service.price === undefined || String(service.price).trim() === '') return '';
        const rawPrice = String(service.price).trim();
        const numericPrice = Number(rawPrice);
        if (Number.isFinite(numericPrice)) {
            return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(numericPrice)}`;
        }
        return rawPrice;
    }

    function addDetailLine(container, label, value) {
        if (!value) return;
        const paragraph = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = `${label}: `;
        paragraph.append(strong, document.createTextNode(String(value)));
        container.appendChild(paragraph);
    }

    function createListingCard(service) {
        const titleText = typeof service.title === 'string' ? service.title.trim() : '';
        if (!titleText) return null;
        const provider = providerFor(service);
        const article = document.createElement('article');
        article.className = 'market-listing';
        article.dataset.listingId = String(service.id || '');
        const body = document.createElement('div');
        body.className = 'market-listing__body';

        const categoryLabel = typeof service.category === 'string' ? service.category.trim() : '';
        if (categoryLabel) {
            const categoryTag = document.createElement('span');
            categoryTag.className = 'market-listing__category';
            categoryTag.textContent = categoryLabel;
            body.appendChild(categoryTag);
        }

        const title = document.createElement('button');
        title.type = 'button';
        title.className = 'market-listing__title';
        title.textContent = titleText;
        title.setAttribute('aria-expanded', 'false');
        body.appendChild(title);

        const descriptionText = typeof service.description === 'string' ? service.description.trim() : '';
        if (descriptionText) {
            const description = document.createElement('p');
            description.className = 'market-listing__description';
            description.textContent = descriptionText;
            body.appendChild(description);
        }

        const meta = document.createElement('div');
        meta.className = 'market-listing__meta';
        if (provider.name) {
            const providerLine = document.createElement('span');
            providerLine.append('Provider: ', Object.assign(document.createElement('b'), { textContent: provider.name }));
            meta.appendChild(providerLine);
        }
        if (typeof service.location === 'string' && service.location.trim()) {
            const locationLine = document.createElement('span');
            locationLine.append('⌖ ', document.createTextNode(service.location.trim()));
            meta.appendChild(locationLine);
        }
        const rating = Number(service.rating);
        const reviewCount = Number(service.review_count || service.reviews_count || service.rating_count);
        if (Number.isFinite(rating) && rating > 0 && Number.isFinite(reviewCount) && reviewCount > 0) {
            const ratingLine = document.createElement('span');
            ratingLine.textContent = `★ ${rating.toFixed(1)} · ${reviewCount} reviews`;
            meta.appendChild(ratingLine);
        }
        if (meta.childNodes.length) body.appendChild(meta);

        const price = servicePrice(service);
        if (price) {
            const priceLine = document.createElement('p');
            priceLine.className = 'market-listing__price';
            priceLine.textContent = price;
            body.appendChild(priceLine);
        }

        const details = document.createElement('div');
        details.className = 'market-listing__details';
        details.hidden = true;
        addDetailLine(details, 'Service', titleText);
        addDetailLine(details, 'Category', categoryLabel);
        addDetailLine(details, 'Provider', provider.name);
        addDetailLine(details, 'Location', typeof service.location === 'string' ? service.location.trim() : '');
        addDetailLine(details, 'Price', price);
        addDetailLine(details, 'Phone', provider.phone);
        addDetailLine(details, 'Email', provider.email);
        addDetailLine(details, 'Description', descriptionText);
        title.addEventListener('click', () => {
            details.hidden = !details.hidden;
            title.setAttribute('aria-expanded', String(!details.hidden));
        });

        const actions = document.createElement('div');
        actions.className = 'market-listing__actions';
        const detailsButton = document.createElement('button');
        detailsButton.type = 'button';
        detailsButton.className = 'market-listing__action';
        detailsButton.textContent = 'View Details';
        detailsButton.addEventListener('click', () => {
            details.hidden = !details.hidden;
            title.setAttribute('aria-expanded', String(!details.hidden));
            detailsButton.textContent = details.hidden ? 'View Details' : 'Hide Details';
        });
        actions.appendChild(detailsButton);

        const safePhone = provider.phone.replace(/[^\d+]/g, '');
        if (safePhone.replace(/\D/g, '').length >= 7) {
            const contact = document.createElement('a');
            contact.className = 'market-listing__action market-listing__action--primary';
            contact.href = `tel:${safePhone}`;
            contact.textContent = 'Call provider';
            actions.appendChild(contact);
        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.email)) {
            const contact = document.createElement('a');
            contact.className = 'market-listing__action market-listing__action--primary';
            contact.href = `mailto:${provider.email}`;
            contact.textContent = 'Email provider';
            actions.appendChild(contact);
        } else {
            const unavailable = document.createElement('button');
            unavailable.type = 'button';
            unavailable.className = 'market-listing__action';
            unavailable.disabled = true;
            unavailable.textContent = 'Contact details unavailable';
            actions.appendChild(unavailable);
        }

        body.append(details, actions);
        article.appendChild(body);
        return article;
    }

    function showState(title, message, kind = 'empty', actions = []) {
        elements.state.replaceChildren();
        elements.state.className = `category-state${kind === 'error' ? ' category-state--error' : ''}`;
        elements.state.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        if (kind === 'loading') {
            const spinner = document.createElement('span');
            spinner.className = 'category-spinner';
            spinner.setAttribute('aria-hidden', 'true');
            elements.state.appendChild(spinner);
        }
        const heading = document.createElement('strong');
        heading.textContent = title;
        const description = document.createElement('p');
        description.textContent = message;
        elements.state.append(heading, description);
        if (actions.length) {
            const actionWrap = document.createElement('div');
            actionWrap.className = 'category-state__actions';
            actions.forEach(action => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'category-state__action';
                button.textContent = action.label;
                button.addEventListener('click', action.onClick);
                actionWrap.appendChild(button);
            });
            elements.state.appendChild(actionWrap);
        }
        elements.state.hidden = false;
        elements.listingGrid.hidden = true;
    }

    function clearServiceSearch() {
        state.search = '';
        state.selectedSubcategory = null;
        elements.search.value = '';
        renderSubcategories();
        renderQuickLinks();
        renderListings();
        elements.search.focus();
    }

    function chooseCity() {
        state.locationMode = 'preferred-city';
        state.coordinates = null;
        state.nearbyError = '';
        updateLocationControls();
        renderListings();
        elements.citySelect.focus();
    }

    function renderListings() {
        const pageServices = getPageServices();
        const chosenCity = state.city;
        elements.listingGrid.replaceChildren();
        updateLocationControls();

        if (state.load === 'loading') {
            elements.resultCount.textContent = 'Loading listings…';
            showState('Loading active listings', 'Fetching current marketplace data.', 'loading');
            return;
        }
        if (state.load === 'error') {
            elements.resultCount.textContent = 'Listings unavailable';
            showState('Listings could not be loaded', 'The live service API is unavailable right now. Please retry to load active data.', 'error', [
                { label: 'Try again', onClick: loadListings }
            ]);
            return;
        }
        if (state.locationMode === 'preferred-city' && !chosenCity) {
            elements.resultCount.textContent = 'Choose a city';
            showState('Choose a preferred city', getLocations().length
                ? 'Select a city or area from active listings. Your service search stays selected.'
                : 'This category has no location values in the active listings yet.', 'empty', [
                    { label: 'Change service', onClick: clearServiceSearch }
                ]);
            return;
        }

        const filtered = pageServices.filter(service => {
            if (state.selectedSubcategory && !subcategoryMatchesService(service, state.selectedSubcategory)) return false;
            if (!state.selectedSubcategory && !matchesSearch(service)) return false;
            if (state.locationMode === 'preferred-city' && normalize(service.location) !== chosenCity) return false;
            if (state.locationMode === 'nearby') {
                const coords = getServiceCoordinates(service);
                if (!coords || !state.coordinates || distanceKm(coords, state.coordinates) > 20) return false;
            }
            return true;
        });

        if (state.locationMode === 'nearby' && state.coordinates) {
            filtered.sort((first, second) => distanceKm(getServiceCoordinates(first), state.coordinates) - distanceKm(getServiceCoordinates(second), state.coordinates));
        }

        const validListings = filtered.map(createListingCard).filter(Boolean);
        validListings.forEach(card => elements.listingGrid.appendChild(card));
        elements.resultCount.textContent = `${validListings.length} ${validListings.length === 1 ? 'listing' : 'listings'}`;

        if (!pageServices.length) {
            showState(`No ${page.name.toLocaleLowerCase()} listings yet`, 'There are no active API listings in this category at the moment. The services and categories above remain available to browse.', 'empty', [
                { label: 'Browse all services', onClick: () => { window.location.href = 'services.html'; } }
            ]);
            return;
        }
        if (!validListings.length) {
            const cityName = getLocations().find(location => location.key === chosenCity)?.label;
            const message = state.locationMode === 'nearby'
                ? (state.coordinates ? 'No active listings with coordinates match this service within 20 km.' : (state.nearbyError || 'Nearby search needs device location and coordinates on active listings.'))
                : state.locationMode === 'preferred-city'
                    ? `No active ${page.name.toLocaleLowerCase()} listings in ${cityName || 'the selected city'} match this service.`
                    : `No active ${page.name.toLocaleLowerCase()} listings match this service search.`;
            showState('No matching listings', message, 'empty', [
                { label: 'Change service', onClick: clearServiceSearch },
                { label: 'Change city', onClick: chooseCity }
            ]);
            return;
        }

        elements.state.hidden = true;
        elements.listingGrid.hidden = false;
    }

    async function loadListings() {
        state.load = 'loading';
        renderListings();
        try {
            const response = await fetch(SERVICE_API_URL, { method: 'GET', headers: { Accept: 'application/json' } });
            const data = await response.json();
            if (!response.ok) throw new Error(data && data.error ? data.error : 'The service API returned an error.');
            if (!Array.isArray(data)) throw new Error('The service API response was not a listings array.');
            state.allServices = data;
            state.load = 'ready';
            const requestedCity = normalize(new URLSearchParams(window.location.search).get('city'));
            if (requestedCity) {
                state.locationMode = 'preferred-city';
                state.city = getLocations().find(location => location.key === requestedCity)?.key || '';
            }
        } catch (error) {
            console.error('Category marketplace listings could not load:', error);
            state.load = 'error';
        }
        updateLocationControls();
        renderListings();
    }

    function setTypedSearch() {
        state.search = elements.search.value.trim();
        state.selectedSubcategory = findSubcategory(state.search);
        renderSubcategories();
        renderQuickLinks();
        renderListings();
    }

    function activateNearby() {
        if (!navigator.geolocation) {
            state.nearbyError = 'Nearby is unavailable in this browser. Choose a Preferred City instead.';
            state.locationMode = '';
            updateLocationControls();
            renderListings();
            return;
        }
        state.locationMode = 'nearby';
        state.city = '';
        state.coordinates = null;
        state.nearbyError = 'Getting your device location…';
        updateLocationControls();
        renderListings();
        navigator.geolocation.getCurrentPosition(position => {
            state.coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
            state.nearbyError = getPageServices().some(service => getServiceCoordinates(service))
                ? 'Showing active listings with coordinates within 20 km.'
                : 'No active listings in this category include coordinates. Choose a Preferred City.';
            updateLocationControls();
            renderListings();
        }, () => {
            state.locationMode = '';
            state.coordinates = null;
            state.nearbyError = 'Nearby Services could not access device location. Choose a Preferred City instead.';
            updateLocationControls();
            renderListings();
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }

    elements.searchForm.addEventListener('submit', event => {
        event.preventDefault();
        setTypedSearch();
        document.getElementById('categoryListings').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    elements.search.addEventListener('input', setTypedSearch);
    elements.nearby.addEventListener('click', activateNearby);
    elements.cityButton.addEventListener('click', () => {
        state.locationMode = state.locationMode === 'preferred-city' ? '' : 'preferred-city';
        state.coordinates = null;
        state.nearbyError = '';
        if (state.locationMode !== 'preferred-city') state.city = '';
        updateLocationControls();
        renderListings();
        if (state.locationMode === 'preferred-city') elements.citySelect.focus();
    });
    elements.citySelect.addEventListener('change', () => {
        state.city = elements.citySelect.value;
        updateLocationControls();
        renderListings();
    });
    elements.viewAll.addEventListener('click', () => {
        state.expandedSubcategories = !state.expandedSubcategories;
        renderSubcategories();
    });
    elements.menuToggle.addEventListener('click', () => {
        const isOpen = elements.nav.classList.toggle('is-open');
        elements.menuToggle.setAttribute('aria-expanded', String(isOpen));
        elements.menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    document.getElementById('categoryLogout').addEventListener('click', event => {
        event.preventDefault();
        if (typeof logout === 'function') logout();
        else window.location.href = 'index.html';
    });

    renderPage();
    updateLocationControls();
    loadListings();

    function initializeHomeServices() {
        const imageFolder = 'assets/demo-providers/';
        const subcategories = {
            plumber: {
                label: 'Plumber',
                description: 'Tap, pipe and household plumbing services.',
                image: imageFolder + 'service-plumber.png',
                pattern: /\bplumb(?:er|ing)?\b|\bpipes?\b|\btap\b|\bdrain(?:age)?\b|\bleaks?\b|\bsanitary\b|\bwater\s*(?:tank|line|pump)\b/i
            },
            electrician: {
                label: 'Electrician',
                description: 'Wiring, lights, fans and electrical repairs.',
                image: imageFolder + 'service-electrician.png',
                pattern: /\belectric(?:al|ian|ity)?\b|\bwiring\b|\bwires?\b|\blights?\b|\bfans?\b|\bswitch(?:es)?\b|\bsockets?\b/i
            },
            cleaning: {
                label: 'Cleaning',
                description: 'Home cleaning and housekeeping services.',
                image: imageFolder + 'service-cleaning.png',
                pattern: /\bclean(?:er|ing)?\b|\bmaid\b|\bhousekeep(?:ing)?\b|\bdomestic\s+(?:help|worker|service)\b|\bdeep\s+clean/i
            },
            'ac-repair': {
                label: 'AC Repair',
                description: 'Air conditioning installation and repair services.',
                image: imageFolder + 'service-ac-repair.png',
                pattern: /\b(?:a\.?c\.?|air\s*condition(?:er|ing)?)\b|\bhvac\b|\bcooling\b/i
            },
            'pest-control': {
                label: 'Pest Control',
                description: 'Pest inspection and treatment services.',
                image: imageFolder + 'service-pest-control.png',
                pattern: /\bpests?\b|\btermites?\b|\bcockroaches?\b|\bmosquitoes?\b|\bfumigat(?:e|ion|or)\b/i
            },
            carpenter: {
                label: 'Carpenter',
                description: 'Carpentry, woodwork and furniture repairs.',
                image: imageFolder + 'service-carpenter.png',
                pattern: /\bcarpent(?:er|ers|ry)\b|\bwoodwork\b|\bcabinets?\b|\bfurniture\b/i
            }
        };

        const otherMainCategoryPattern = /\b(?:food|sweets?|restaurants?|baker(?:y|ies)|dhaba|catering|caf[eé]|snacks?|travel|hotels?|lodging|stays?|tours?|cabs?|taxis?|transport|drivers?|vehicles?|shopping|shops?|market|retail|groceries?|beauty|events?|salon|make\s*up|parlour|parlor|construction|buildings?|contractors?|renovations?|civil|masonry)\b/i;
        const homeCategoryPattern = /\b(?:home|house|domestic|clean(?:ing)?|carpenter|carpentry|garden|handyman)\b/i;

        let allServices = [];
        let serviceSearchTerm = '';
        let activeSubcategory = 'plumber';
        let activeLocationMode = '';
        let preferredCityValue = '';
        let userCoordinates = null;
        let activeDetailsButton = null;
        let selectedProviderService = null;

        const elements = {
            buttons: document.getElementById('subcategoryButtons'),
            searchForm: document.getElementById('serviceSearchForm'),
            search: document.getElementById('serviceSearch'),
            nearbyOption: document.getElementById('nearbyServicesOption'),
            preferredCityOption: document.getElementById('preferredCityOption'),
            citySelectWrap: document.getElementById('preferredCitySelectWrap'),
            citySelect: document.getElementById('preferredCitySelect'),
            locationStatus: document.getElementById('locationFilterStatus'),
            selectedImage: document.getElementById('selectedServiceImage'),
            promoImage: document.getElementById('servicePromoImage'),
            selectedTitle: document.getElementById('selectedServiceTitle'),
            selectedDescription: document.getElementById('selectedServiceDescription'),
            promoText: document.getElementById('servicePromoText'),
            providerHeading: document.getElementById('providerHeading'),
            resultCount: document.getElementById('serviceResultCount'),
            state: document.getElementById('serviceState'),
            list: document.getElementById('serviceList'),
            providerDetails: document.getElementById('selectedProviderDetails'),
            providerDetailsTitle: document.getElementById('providerDetailsTitle'),
            providerDetailsContent: document.getElementById('providerDetailsContent'),
            providerDetailsActions: document.getElementById('providerDetailsActions'),
            providerDetailsContactStatus: document.getElementById('providerDetailsContactStatus'),
            closeProviderDetails: document.getElementById('closeProviderDetails')
        };

        function readString(value) {
            return typeof value === 'string' ? value.trim() : '';
        }

        function getProvider(service) {
            const provider = Array.isArray(service.users) ? service.users[0] : service.users;
            return provider && typeof provider === 'object' ? provider : {};
        }

        function getProviderName(service) {
            const provider = getProvider(service);
            const candidates = [service.provider_name, service.providerName, provider.name]
                .map(readString)
                .filter(name => name && name.toLocaleLowerCase() !== 'service provider');
            return candidates[0] || '';
        }

        function getProviderPhone(service) {
            return readString(getProvider(service).phone) || readString(service.phone);
        }

        function getProviderEmail(service) {
            return readString(getProvider(service).email) || readString(service.email);
        }

        function getServiceCoordinates(service) {
            if (!service) return null;
            const latitudeValue = service.latitude;
            const longitudeValue = service.longitude;
            if (!['number', 'string'].includes(typeof latitudeValue) ||
                !['number', 'string'].includes(typeof longitudeValue) ||
                (typeof latitudeValue === 'string' && !latitudeValue.trim()) ||
                (typeof longitudeValue === 'string' && !longitudeValue.trim())) {
                return null;
            }

            const latitude = Number(latitudeValue);
            const longitude = Number(longitudeValue);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
                latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                return null;
            }
            return { latitude, longitude };
        }

        function getListingSearchText(service) {
            return [
                service.title,
                service.description,
                service.category,
                service.location,
                getProviderName(service)
            ].map(readString).filter(Boolean).join(' ');
        }

        function isHomeService(service) {
            const category = readString(service.category);
            if (otherMainCategoryPattern.test(category)) return false;
            if (homeCategoryPattern.test(category)) return true;
            const searchable = [service.title, service.description, category].map(readString).filter(Boolean).join(' ');
            return Object.values(subcategories).some(subcategory => subcategory.pattern.test(searchable));
        }

        function getHomeServices() {
            return allServices.filter(isHomeService);
        }

        function getUniqueLocations(services) {
            const locations = new Map();
            services.forEach(service => {
                const location = readString(service.location);
                const key = location.toLocaleLowerCase();
                if (key && !locations.has(key)) locations.set(key, location);
            });
            return Array.from(locations, ([key, label]) => ({ key, label }))
                .sort((first, second) => first.label.localeCompare(second.label));
        }

        function updateLocationControlState() {
            const homeServices = getHomeServices();
            const coordinateCount = homeServices.filter(getServiceCoordinates).length;
            const hasGeolocation = typeof navigator !== 'undefined' && !!navigator.geolocation;
            const locations = getUniqueLocations(homeServices);

            if (activeLocationMode === 'nearby' && (!coordinateCount || !userCoordinates)) {
                activeLocationMode = '';
                userCoordinates = null;
            }
            if (activeLocationMode === 'preferred-city' && !locations.length) {
                activeLocationMode = '';
                preferredCityValue = '';
            }

            elements.nearbyOption.disabled = !coordinateCount || !hasGeolocation;
            elements.preferredCityOption.disabled = !locations.length;
            elements.nearbyOption.setAttribute('aria-pressed', String(activeLocationMode === 'nearby'));
            elements.preferredCityOption.setAttribute('aria-pressed', String(activeLocationMode === 'preferred-city'));
            elements.citySelectWrap.hidden = activeLocationMode !== 'preferred-city';
            elements.citySelect.disabled = activeLocationMode !== 'preferred-city' || !locations.length;

            if (activeLocationMode === 'nearby') {
                const unlocatedCount = homeServices.length - coordinateCount;
                elements.locationStatus.textContent = unlocatedCount
                    ? `Nearby results · ${unlocatedCount} listing${unlocatedCount === 1 ? '' : 's'} without coordinates hidden.`
                    : 'Nearby listings sorted by distance.';
            } else if (activeLocationMode === 'preferred-city' && preferredCityValue) {
                const selectedLocation = locations.find(location => location.key === preferredCityValue);
                elements.locationStatus.textContent = selectedLocation
                    ? `Showing listings in ${selectedLocation.label}.`
                    : 'Choose a city from active listings.';
            } else if (!coordinateCount) {
                elements.locationStatus.textContent = 'Nearby needs listing coordinates. City options come from service listings.';
            } else if (!hasGeolocation) {
                elements.locationStatus.textContent = 'Nearby needs browser location. City options come from listings.';
            } else {
                elements.locationStatus.textContent = locations.length
                    ? 'Choose nearby results or a city from active listings.'
                    : 'Choose nearby results. City options appear when listings include locations.';
            }
        }

        function refreshCityOptions() {
            const selectedValue = preferredCityValue;
            elements.citySelect.replaceChildren();
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a listed city / area';
            elements.citySelect.appendChild(placeholder);

            const locations = getUniqueLocations(getHomeServices());
            locations.forEach(location => {
                const option = document.createElement('option');
                option.value = location.key;
                option.textContent = location.label;
                elements.citySelect.appendChild(option);
            });

            if (locations.some(location => location.key === selectedValue)) {
                preferredCityValue = selectedValue;
                elements.citySelect.value = selectedValue;
            } else {
                preferredCityValue = '';
                elements.citySelect.value = '';
                if (activeLocationMode === 'preferred-city') activeLocationMode = '';
            }
            updateLocationControlState();
        }

        function activatePreferredCity() {
            if (activeLocationMode === 'preferred-city') {
                activeLocationMode = '';
                preferredCityValue = '';
                elements.citySelect.value = '';
            } else {
                activeLocationMode = 'preferred-city';
                preferredCityValue = '';
                userCoordinates = null;
                elements.citySelect.value = '';
            }
            updateLocationControlState();
            renderServices();
        }

        function calculateDistanceKm(first, second) {
            const radians = degrees => degrees * Math.PI / 180;
            const latitudeDelta = radians(second.latitude - first.latitude);
            const longitudeDelta = radians(second.longitude - first.longitude);
            const firstLatitude = radians(first.latitude);
            const secondLatitude = radians(second.latitude);
            const haversine = Math.min(1, Math.sin(latitudeDelta / 2) ** 2 +
                Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2);
            return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
        }

        async function activateNearbyServices() {
            if (activeLocationMode === 'nearby') {
                activeLocationMode = '';
                userCoordinates = null;
                updateLocationControlState();
                renderServices();
                return;
            }

            if (elements.nearbyOption.disabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
            elements.locationStatus.textContent = 'Requesting permission to use your device location…';
            elements.nearbyOption.disabled = true;
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        maximumAge: 60000,
                        timeout: 12000
                    });
                });
                const latitude = Number(position.coords.latitude);
                const longitude = Number(position.coords.longitude);
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
                    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                    throw new Error('The browser returned invalid coordinates.');
                }

                userCoordinates = { latitude, longitude };
                preferredCityValue = '';
                elements.citySelect.value = '';
                activeLocationMode = 'nearby';
            } catch (error) {
                activeLocationMode = '';
                userCoordinates = null;
                elements.locationStatus.textContent = error && error.code === 1
                    ? 'Nearby Services needs location permission. You can allow it and try again.'
                    : 'Nearby Services could not get your device location. Try again or choose a Preferred City.';
            }
            updateLocationControlState();
            renderServices();
        }

        function getServiceImageUrl(service) {
            const imageFields = ['image_url', 'imageUrl', 'photo_url', 'photoUrl', 'image', 'photo'];
            const rawImage = imageFields
                .map(field => service[field])
                .find(value => typeof value === 'string' && value.trim());
            return getSafeServiceImageUrl(rawImage);
        }

        function getProviderPhotoUrl(service) {
            const provider = getProvider(service);
            return getSafeServiceImageUrl(
                readString(service.provider_photo_url) ||
                readString(service.profile_photo_url) ||
                readString(provider.profile_photo_url)
            );
        }

        function getSafeServiceImageUrl(rawImage) {
            if (typeof rawImage !== 'string' || !rawImage.trim()) return '';
            try {
                const imageUrl = new URL(rawImage.trim(), window.location.href);
                if (imageUrl.protocol !== 'https:' &&
                    !(imageUrl.protocol === 'http:' && imageUrl.origin === window.location.origin)) {
                    return '';
                }
                return imageUrl.href;
            } catch (error) {
                return '';
            }
        }

        function getServicePrice(price) {
            if (price === null || price === undefined || price === '') return '';
            const rawPrice = String(price).trim();
            if (!rawPrice) return '';
            const numericPrice = Number(rawPrice.replace(/[₹,\s]/g, ''));
            if (!Number.isFinite(numericPrice) || numericPrice < 0) return rawPrice;
            return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(numericPrice);
        }

        function makeTextElement(tagName, className, text) {
            const element = document.createElement(tagName);
            if (className) element.className = className;
            element.textContent = text;
            return element;
        }

        function getTelephoneLink(phone) {
            const digits = phone.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) return '';
            return 'tel:' + (phone.trim().startsWith('+') ? '+' : '') + digits;
        }

        function getEmailLink(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'mailto:' + email : '';
        }

        function appendProviderDetail(container, label, value, href) {
            const item = document.createElement('div');
            item.dataset.detail = label.toLocaleLowerCase();
            item.appendChild(makeTextElement('dt', '', label));
            const detail = document.createElement('dd');
            const text = readString(value) || 'Unavailable';
            if (href && text !== 'Unavailable') {
                const link = makeTextElement('a', '', text);
                link.href = href;
                detail.appendChild(link);
            } else {
                detail.textContent = text;
            }
            item.appendChild(detail);
            container.appendChild(item);
        }

        function hideSelectedProviderDetails() {
            if (activeDetailsButton && activeDetailsButton.isConnected) {
                activeDetailsButton.textContent = 'View Details';
                activeDetailsButton.setAttribute('aria-expanded', 'false');
            }
            activeDetailsButton = null;
            selectedProviderService = null;
            elements.providerDetails.hidden = true;
            elements.providerDetailsContent.replaceChildren();
            elements.providerDetailsActions.replaceChildren();
            elements.providerDetailsContactStatus.hidden = true;
            elements.providerDetailsContactStatus.textContent = '';
        }

        function addContactAction(service) {
            const phone = getProviderPhone(service);
            const phoneLink = getTelephoneLink(phone);
            const email = getProviderEmail(service);
            const emailLink = getEmailLink(email);

            if (phoneLink) {
                const callLink = makeTextElement('a', 'provider-details-panel__action provider-details-panel__action--primary', 'Call provider');
                callLink.href = phoneLink;
                elements.providerDetailsActions.appendChild(callLink);
            } else if (service.id !== undefined && service.id !== null) {
                const callButton = makeTextElement('button', 'provider-details-panel__action provider-details-panel__action--primary', 'Load phone number');
                callButton.type = 'button';
                callButton.addEventListener('click', () => {
                    const phoneLink = callButton.dataset.phoneLink;
                    if (phoneLink) {
                        window.location.href = phoneLink;
                        return;
                    }
                    loadProviderPhone(service, callButton);
                });
                elements.providerDetailsActions.appendChild(callButton);
            } else {
                const unavailable = makeTextElement('button', 'provider-details-panel__action', 'Contact unavailable');
                unavailable.type = 'button';
                unavailable.disabled = true;
                elements.providerDetailsActions.appendChild(unavailable);
            }

            if (emailLink) {
                const emailLinkElement = makeTextElement('a', 'provider-details-panel__action', 'Email provider');
                emailLinkElement.href = emailLink;
                elements.providerDetailsActions.appendChild(emailLinkElement);
            }
        }

        async function loadProviderPhone(service, button) {
            let token = '';
            try {
                token = window.localStorage.getItem('token') || '';
            } catch (error) {
                token = '';
            }
            if (!token) {
                window.alert('Pehle login karein.');
                return;
            }

            button.disabled = true;
            button.textContent = 'Loading phone…';
            const requestIsCurrent = () =>
                button.isConnected && selectedProviderService === service && !elements.providerDetails.hidden;
            try {
                const response = await fetch(
                    SERVICE_API_URL + '/' + encodeURIComponent(service.id) + '/contact',
                    { headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } }
                );
                const data = await response.json();
                if (!response.ok || !data || typeof data.phone !== 'string' || !data.phone.trim()) {
                    throw new Error(data && data.error ? data.error : 'Phone number unavailable.');
                }

                if (!requestIsCurrent()) return;
                const phone = data.phone.trim();
                const phoneLink = getTelephoneLink(phone);
                if (!phoneLink) throw new Error('Phone number unavailable.');
                const phoneRow = elements.providerDetailsContent.querySelector('[data-detail="phone"] dd');
                if (phoneRow) {
                    phoneRow.replaceChildren();
                    const phoneAnchor = makeTextElement('a', '', phone);
                    phoneAnchor.href = phoneLink;
                    phoneRow.appendChild(phoneAnchor);
                }
                const providerName = readString(data.name);
                if (providerName && providerName.toLocaleLowerCase() !== 'service provider') {
                    elements.providerDetailsTitle.textContent = providerName;
                    const providerRow = elements.providerDetailsContent.querySelector('[data-detail="provider"] dd');
                    if (providerRow) providerRow.textContent = providerName;
                }
                button.textContent = 'Call provider';
                button.disabled = false;
                button.dataset.phoneLink = phoneLink;
                elements.providerDetailsContactStatus.textContent = 'Provider phone loaded from the contact API.';
                elements.providerDetailsContactStatus.hidden = false;
            } catch (error) {
                if (!requestIsCurrent()) return;
                button.textContent = 'Phone unavailable';
                button.disabled = true;
                elements.providerDetailsContactStatus.textContent = error && error.message
                    ? error.message
                    : 'Provider phone is unavailable.';
                elements.providerDetailsContactStatus.hidden = false;
            }
        }

        function toggleSelectedProviderDetails(service, button) {
            if (!elements.providerDetails.hidden && selectedProviderService === service) {
                hideSelectedProviderDetails();
                return;
            }

            hideSelectedProviderDetails();
            selectedProviderService = service;
            activeDetailsButton = button;
            const providerName = getProviderName(service) || 'Unavailable';
            const phone = getProviderPhone(service);
            const email = getProviderEmail(service);
            const formattedPrice = getServicePrice(service.price);
            const content = elements.providerDetailsContent;
            content.replaceChildren();

            elements.providerDetailsTitle.textContent = providerName;
            appendProviderDetail(content, 'Provider', providerName);
            appendProviderDetail(content, 'Service', readString(service.title));
            appendProviderDetail(content, 'Description', readString(service.description));
            appendProviderDetail(content, 'City', readString(service.location));
            appendProviderDetail(content, 'Price', formattedPrice);
            appendProviderDetail(content, 'Category', readString(service.category));
            appendProviderDetail(content, 'Phone', phone, getTelephoneLink(phone));
            appendProviderDetail(content, 'Email', email, getEmailLink(email));
            addContactAction(service);

            elements.providerDetails.hidden = false;
            button.textContent = 'Hide Details';
            button.setAttribute('aria-expanded', 'true');
            elements.providerDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function createProviderCard(service) {
            const card = document.createElement('article');
            card.className = 'provider-card';
            if (service.id !== undefined && service.id !== null) card.dataset.serviceId = String(service.id);

            const providerName = getProviderName(service) || 'Provider name unavailable';
            const serviceTitle = readString(service.title) || 'Service title unavailable';
            const serviceLocation = readString(service.location) || 'City unavailable';
            const providerPhotoUrl = getProviderPhotoUrl(service);
            const serviceImageUrl = getServiceImageUrl(service);
            const categoryImageUrl = subcategories[activeSubcategory].image;
            const imageOptions = [
                providerPhotoUrl && { url: providerPhotoUrl, alt: 'Provider profile photo from the service listing.' },
                serviceImageUrl && { url: serviceImageUrl, alt: 'Photo attached to this service listing.' },
                { url: categoryImageUrl, alt: 'Illustrative ' + subcategories[activeSubcategory].label.toLocaleLowerCase() + ' service scene; not a provider photo.' },
                { url: imageFolder + 'demo-provider-placeholder.svg', alt: 'Generic service image placeholder; not a provider photo.' }
            ].filter(Boolean).filter((option, index, options) =>
                options.findIndex(candidate => candidate.url === option.url) === index
            );
            let imageOptionIndex = 0;
            const image = document.createElement('img');
            image.className = 'provider-card__image';
            image.src = imageOptions[imageOptionIndex].url;
            image.alt = imageOptions[imageOptionIndex].alt;
            image.loading = 'lazy';
            image.addEventListener('error', function useNextServiceImage() {
                imageOptionIndex += 1;
                if (imageOptionIndex >= imageOptions.length) return;
                image.src = imageOptions[imageOptionIndex].url;
                image.alt = imageOptions[imageOptionIndex].alt;
            });
            card.appendChild(image);

            const main = document.createElement('div');
            main.className = 'provider-card__main';
            main.appendChild(makeTextElement('h3', 'provider-card__provider', providerName));
            main.appendChild(makeTextElement('p', 'provider-card__service', serviceTitle));
            main.appendChild(makeTextElement('p', 'provider-card__city', serviceLocation));
            const formattedPrice = getServicePrice(service.price);
            main.appendChild(makeTextElement(
                'p',
                'provider-card__price' + (formattedPrice ? '' : ' is-unavailable'),
                formattedPrice || 'Price unavailable'
            ));
            card.appendChild(main);

            const detailsButton = makeTextElement('button', 'provider-card__details-button', 'View Details');
            detailsButton.type = 'button';
            detailsButton.setAttribute('aria-expanded', 'false');
            detailsButton.setAttribute('aria-controls', 'selectedProviderDetails');
            detailsButton.addEventListener('click', () => toggleSelectedProviderDetails(service, detailsButton));
            card.appendChild(detailsButton);
            return card;
        }

        function matchesService(service) {
            if (!isHomeService(service)) return false;
            if (!subcategories[activeSubcategory].pattern.test(getListingSearchText(service))) return false;
            if (activeLocationMode === 'preferred-city') {
                if (!preferredCityValue || readString(service.location).toLocaleLowerCase() !== preferredCityValue) return false;
            }
            if (activeLocationMode === 'nearby' && (!userCoordinates || !getServiceCoordinates(service))) return false;
            if (serviceSearchTerm && !getListingSearchText(service).toLocaleLowerCase().includes(serviceSearchTerm)) return false;
            return true;
        }

        function showState(message) {
            elements.state.hidden = false;
            elements.state.textContent = message;
            elements.list.hidden = true;
        }

        function renderServices() {
            const definition = subcategories[activeSubcategory];
            const filteredServices = getHomeServices().filter(matchesService);
            hideSelectedProviderDetails();
            if (activeLocationMode === 'nearby' && userCoordinates) {
                filteredServices.sort((first, second) =>
                    calculateDistanceKm(getServiceCoordinates(first), userCoordinates) -
                    calculateDistanceKm(getServiceCoordinates(second), userCoordinates)
                );
            }

            elements.list.replaceChildren();
            elements.providerHeading.textContent = definition.label + ' listings';

            if (!allServices.length) {
                elements.resultCount.textContent = 'Listings unavailable';
                showState('No home service listings are available right now.');
                return;
            }
            if (activeLocationMode === 'preferred-city' && !preferredCityValue) {
                elements.resultCount.textContent = 'Choose a city / area';
                showState('Select a city from the active listings to filter results.');
                return;
            }

            elements.resultCount.textContent = filteredServices.length + ' ' +
                (filteredServices.length === 1 ? 'listing' : 'listings');
            if (!filteredServices.length) {
                showState('No ' + definition.label.toLocaleLowerCase() + ' listings match these filters yet. Try another subcategory, search, or city.');
                return;
            }

            elements.state.hidden = true;
            elements.list.hidden = false;
            filteredServices.forEach(service => elements.list.appendChild(createProviderCard(service)));
        }

        function selectSubcategory(key) {
            if (!subcategories[key]) return;
            activeSubcategory = key;
            const definition = subcategories[key];
            elements.buttons.querySelectorAll('[data-subcategory]').forEach(button => {
                button.setAttribute('aria-pressed', String(button.dataset.subcategory === key));
            });
            elements.selectedImage.src = definition.image;
            elements.selectedImage.alt = 'Illustrative ' + definition.label.toLocaleLowerCase() + ' service scene; not a provider photo.';
            elements.promoImage.src = definition.image;
            elements.selectedTitle.textContent = definition.label;
            elements.selectedDescription.textContent = definition.description;
            elements.promoText.textContent = 'Browse real ' + definition.label.toLocaleLowerCase() + ' listings shared by local providers.';
            elements.providerHeading.textContent = definition.label + ' listings';
            renderServices();
        }

        async function loadServices() {
            try {
                const response = await fetch(SERVICE_API_URL, { method: 'GET', headers: { Accept: 'application/json' } });
                const data = await response.json();
                if (!response.ok) throw new Error(data && data.error ? data.error : 'Services could not be loaded.');
                if (!Array.isArray(data)) throw new Error('The services response was not valid.');

                allServices = data;
                refreshCityOptions();
                renderServices();
            } catch (error) {
                console.error('Error loading Home Services listings:', error);
                elements.nearbyOption.disabled = true;
                elements.preferredCityOption.disabled = true;
                elements.citySelect.disabled = true;
                elements.locationStatus.textContent = 'Location options are unavailable until service listings load.';
                elements.resultCount.textContent = 'Listings unavailable';
                showState(error && error.message ? error.message : 'Home service listings could not be loaded.');
            }
        }

        elements.buttons.addEventListener('click', event => {
            const button = event.target.closest('[data-subcategory]');
            if (button && elements.buttons.contains(button)) selectSubcategory(button.dataset.subcategory);
        });

        elements.searchForm.addEventListener('submit', event => {
            event.preventDefault();
            serviceSearchTerm = elements.search.value.trim().toLocaleLowerCase();
            renderServices();
        });
        elements.search.addEventListener('input', () => {
            serviceSearchTerm = elements.search.value.trim().toLocaleLowerCase();
            renderServices();
        });
        elements.nearbyOption.addEventListener('click', activateNearbyServices);
        elements.preferredCityOption.addEventListener('click', activatePreferredCity);
        elements.citySelect.addEventListener('change', () => {
            preferredCityValue = elements.citySelect.value;
            updateLocationControlState();
            renderServices();
        });
        document.getElementById('jumpToListings').addEventListener('click', () => {
            document.getElementById('serviceListings').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        document.getElementById('promoBrowseButton').addEventListener('click', () => {
            document.getElementById('serviceListings').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        elements.closeProviderDetails.addEventListener('click', hideSelectedProviderDetails);

        loadServices();
    }
})();
