(() => {
    'use strict';

    const SERVICE_API_URL = 'https://samarthai-backend.onrender.com/api/services';
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
})();
