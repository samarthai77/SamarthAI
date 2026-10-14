(() => {
    const imageFolder = 'assets/demo-providers/';
    const subcategories = {
        plumber: {
            label: 'Plumber',
            description: 'Tap, pipe and household plumbing services.',
            image: imageFolder + 'demo-plumber.svg',
            pattern: /\bplumb(?:er|ing)?\b|\bpipes?\b|\btap\b|\bdrain(?:age)?\b|\bleaks?\b|\bsanitary\b|\bwater\s*(?:tank|line|pump)\b/i
        },
        electrician: {
            label: 'Electrician',
            description: 'Wiring, lights, fans and electrical repairs.',
            image: imageFolder + 'demo-electrician.svg',
            pattern: /\belectric(?:al|ian|ity)?\b|\bwiring\b|\bwires?\b|\blights?\b|\bfans?\b|\bswitch(?:es)?\b|\bsockets?\b/i
        },
        cleaning: {
            label: 'Cleaning',
            description: 'Home cleaning and housekeeping services.',
            image: imageFolder + 'demo-cleaning.svg',
            pattern: /\bclean(?:er|ing)?\b|\bmaid\b|\bhousekeep(?:ing)?\b|\bdomestic\s+(?:help|worker|service)\b|\bdeep\s+clean/i
        },
        'ac-repair': {
            label: 'AC Repair',
            description: 'Air conditioning installation and repair services.',
            image: imageFolder + 'demo-ac-repair.svg',
            pattern: /\b(?:a\.?c\.?|air\s*condition(?:er|ing)?)\b|\bhvac\b|\bcooling\b/i
        },
        'pest-control': {
            label: 'Pest Control',
            description: 'Pest inspection and treatment services.',
            image: imageFolder + 'demo-pest-control.svg',
            pattern: /\bpests?\b|\btermites?\b|\bcockroaches?\b|\bmosquitoes?\b|\bfumigat(?:e|ion|or)\b/i
        },
        carpenter: {
            label: 'Carpenter',
            description: 'Carpentry, woodwork and furniture repairs.',
            image: imageFolder + 'demo-carpenter.svg',
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
        selectedTitle: document.getElementById('selectedServiceTitle'),
        selectedDescription: document.getElementById('selectedServiceDescription'),
        promoText: document.getElementById('servicePromoText'),
        providerHeading: document.getElementById('providerHeading'),
        resultCount: document.getElementById('serviceResultCount'),
        state: document.getElementById('serviceState'),
        list: document.getElementById('serviceList')
    };

    function readString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function getProviderName(service) {
        const provider = Array.isArray(service.users) ? service.users[0] : service.users;
        return provider && typeof provider.name === 'string' ? provider.name.trim() : '';
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
        if (!rawImage) return '';

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
        const numericPrice = Number(price);
        if (!Number.isFinite(numericPrice) || numericPrice < 0) return '';
        return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(numericPrice);
    }

    function makeTextElement(tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text;
        return element;
    }

    function createProviderCard(service) {
        const card = document.createElement('article');
        card.className = 'provider-card';
        if (service.id !== undefined && service.id !== null) card.dataset.serviceId = String(service.id);

        const image = document.createElement('img');
        image.className = 'provider-card__image';
        image.src = getServiceImageUrl(service) || imageFolder + 'demo-provider-placeholder.svg';
        image.alt = getServiceImageUrl(service) ? readString(service.title) : 'Temporary demo image placeholder';
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            image.src = imageFolder + 'demo-provider-placeholder.svg';
            image.alt = 'Temporary demo image placeholder';
        }, { once: true });
        card.appendChild(image);

        const main = document.createElement('div');
        main.className = 'provider-card__main';
        main.appendChild(makeTextElement('h3', 'provider-card__provider', getProviderName(service) || 'Provider name unavailable'));
        main.appendChild(makeTextElement('p', 'provider-card__service', readString(service.title) || 'Service title unavailable'));
        main.appendChild(makeTextElement('p', 'provider-card__city', readString(service.location) || 'City not provided'));
        const formattedPrice = getServicePrice(service.price);
        if (formattedPrice) main.appendChild(makeTextElement('p', 'provider-card__price', formattedPrice));
        card.appendChild(main);

        const details = document.createElement('div');
        details.className = 'provider-card__details';
        details.hidden = true;
        details.appendChild(makeTextElement(
            'p',
            '',
            readString(service.description) || 'No description was provided for this listing.'
        ));
        const category = readString(service.category);
        if (category) details.appendChild(makeTextElement('p', '', 'Category: ' + category));
        card.appendChild(details);

        const detailsButton = makeTextElement('button', 'provider-card__details-button', 'View Details');
        detailsButton.type = 'button';
        detailsButton.setAttribute('aria-expanded', 'false');
        detailsButton.addEventListener('click', () => {
            const willExpand = details.hidden;
            details.hidden = !willExpand;
            detailsButton.textContent = willExpand ? 'Hide Details' : 'View Details';
            detailsButton.setAttribute('aria-expanded', String(willExpand));
        });
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
        elements.selectedImage.alt = '';
        elements.selectedTitle.textContent = definition.label;
        elements.selectedDescription.textContent = definition.description;
        elements.promoText.textContent = 'Browse real ' + definition.label.toLocaleLowerCase() + ' listings shared by local providers.';
        elements.providerHeading.textContent = definition.label + ' listings';
        renderServices();
    }

    async function loadServices() {
        try {
            const response = await fetch(API_BASE + '/services', { method: 'GET' });
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

    loadServices();
})();
