/* Device-only GPS. No location uploads, persistent storage, maps or geocoding. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    let watchId = null, generation = 0, active = false, awaitingFix = false, reading = null;
    let ageTimer = null, permission = null, disposed = false;
    const number = new Intl.NumberFormat('en-IN', {maximumFractionDigits: 1});
    const date = new Intl.DateTimeFormat('hi-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    function status(text, error = false) {
        $('gpsStatus').textContent = text;
        $('gpsStatus').classList.toggle('error', error);
    }
    function updateControls() {
        $('startGps').disabled = active;
        $('stopGps').disabled = !active;
        $('clearGps').disabled = !reading;
        $('trackingBadge').textContent = active ? 'Tracking चालू' : 'बंद';
        $('trackingBadge').classList.toggle('active', active);
    }
    function updateAge() {
        if(!reading) return;
        if(reading.timestamp === null) {
            $('readingStatus').textContent = active ? 'Position मिली · समय उपलब्ध नहीं' : 'अंतिम reading · समय उपलब्ध नहीं';
            $('readingAge').textContent = 'Browser ने valid position timestamp नहीं दिया। कोई अनुमानित समय नहीं दिखाया जा रहा।';
            return;
        }
        const age = Date.now() - reading.timestamp;
        if(age < -5000) {
            $('readingStatus').textContent = 'Device time जाँचें';
            $('readingAge').textContent = 'Position timestamp device के वर्तमान समय से आगे है। Timestamp बदला नहीं गया है।';
        } else if(!active) {
            $('readingStatus').textContent = 'अंतिम reading · live नहीं';
            $('readingAge').textContent = 'Tracking बंद है। ऊपर का समय अंतिम position का है; यह वर्तमान location की पुष्टि नहीं है।';
        } else {
            const seconds = Math.floor(Math.max(0, age) / 1000);
            $('readingStatus').textContent = age > 60000 ? 'पुरानी reading · नई position की प्रतीक्षा' : awaitingFix ? 'अंतिम reading · नई position की प्रतीक्षा' : 'Tracking चालू · position प्राप्त';
            $('readingAge').textContent = 'Position की उम्र: ' + number.format(seconds) + ' seconds। नई reading मिलने पर coordinates और समय अपडेट होंगे।';
        }
    }
    function clearReading() {
        reading = null;
        for(const id of ['latitude','longitude','accuracy','lastUpdated']) $(id).textContent = '—';
        $('readingStatus').textContent = 'कोई reading नहीं';
        $('readingAge').textContent = 'इस page पर location reading उपलब्ध नहीं है।';
        updateControls();
    }
    function stopTracking(message = 'Tracking बंद है। Location watch बंद कर दी गई है।') {
        generation++;
        active = false; awaitingFix = false;
        if(watchId !== null) {
            navigator.geolocation?.clearWatch(watchId);
            watchId = null;
        }
        clearInterval(ageTimer); ageTimer = null;
        updateControls(); updateAge(); status(message);
    }
    function fail(error, epoch) {
        if(epoch !== generation || !active) return;
        if(error.code === 1) {
            stopTracking();
            clearReading();
            status('Location permission नहीं मिली। Browser / phone settings में अनुमति दें, फिर Start GPS दबाएँ।', true);
        } else if(error.code === 2) {
            awaitingFix = true; updateAge();
            status('Location उपलब्ध नहीं है। Phone की Location/GPS setting, signal और network जाँचें। नई position की प्रतीक्षा है; Stop से tracking बंद करें।', true);
        } else if(error.code === 3) {
            awaitingFix = true; updateAge();
            status('समय सीमा में नई location नहीं मिली। खुली जगह में Location setting जाँचें। नई position की प्रतीक्षा है; Stop से tracking बंद करें।', true);
        } else { stopTracking(); status('Device से location नहीं मिली। Tracking रोक दी गई है; दोबारा कोशिश करें।', true); }
    }
    function receive(position, epoch) {
        if(epoch !== generation || !active || document.hidden) return;
        const coords = position?.coords;
        if(!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number' ||
            !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude) ||
            coords.latitude < -90 || coords.latitude > 90 || coords.longitude < -180 || coords.longitude > 180 ||
            typeof coords.accuracy !== 'number' || !Number.isFinite(coords.accuracy) || coords.accuracy < 0) {
            fail({code: 2}, epoch); return;
        }
        const timestamp = typeof position.timestamp === 'number' && Number.isFinite(position.timestamp) &&
            position.timestamp > 0 && !Number.isNaN(new Date(position.timestamp).getTime()) ? position.timestamp : null;
        reading = {latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp};
        awaitingFix = false;
        $('latitude').textContent = reading.latitude.toFixed(6);
        $('longitude').textContent = reading.longitude.toFixed(6);
        $('accuracy').textContent = '± ' + number.format(reading.accuracy) + ' m';
        $('lastUpdated').textContent = timestamp === null ? 'उपलब्ध नहीं' : date.format(timestamp);
        status('Device position मिल गई। यह केवल इस page पर है; कहीं share नहीं की गई।');
        updateControls(); updateAge();
    }
    function startTracking() {
        if(active || disposed) return;
        if(!window.isSecureContext) { status('GPS के लिए HTTPS पर page खोलें। Location access शुरू नहीं किया गया।', true); return; }
        if(!navigator.geolocation?.watchPosition) { status('इस browser में Geolocation उपलब्ध नहीं है। किसी supported browser में HTTPS पर खोलें।', true); return; }
        if(document.hidden) return;
        const epoch = ++generation;
        active = true; awaitingFix = true;
        updateControls(); updateAge();
        status('वास्तविक device location की प्रतीक्षा है। Browser पूछे तो Location permission चुनें।');
        try {
            const id = navigator.geolocation.watchPosition(position => receive(position, epoch), error => fail(error, epoch), {
                enableHighAccuracy: true, maximumAge: 0, timeout: 15000
            });
            // Even a callback delivered during registration must not leave a watch behind.
            if(epoch !== generation || !active) navigator.geolocation.clearWatch(id);
            else {
                watchId = id;
                ageTimer = setInterval(updateAge, 10000);
            }
        } catch { fail({}, epoch); }
    }
    function showPermission() {
        const labels = {granted: 'मिली हुई है · tracking अपने-आप शुरू नहीं होगी', prompt: 'Start GPS पर browser पूछ सकता है', denied: 'अस्वीकृत · browser / phone settings में बदलें'};
        $('permissionStatus').textContent = 'Browser location permission: ' + (labels[permission?.state] || 'Start GPS पर browser / OS तय करेगा');
    }
    async function inspectPermission() {
        if(!navigator.permissions?.query) { showPermission(); return; }
        try {
            const result = await navigator.permissions.query({name: 'geolocation'});
            if(disposed) return;
            permission = result;
            permission.onchange = () => {
                showPermission();
                if(permission.state === 'denied') { stopTracking('Location permission हट गई है। Tracking बंद है।'); clearReading(); }
            };
        } catch { /* Some browsers support GPS without Permissions API inspection. */ }
        showPermission();
    }
    function showNetwork() {
        $('networkStatus').textContent = navigator.onLine === false
            ? 'Network: offline। कुछ devices पर GPS फिर भी मिल सकता है; network-based positioning उपलब्ध न हो सकती है।'
            : 'Network: connection उपलब्ध बताई गई है। इससे GPS fix मिलने की गारंटी नहीं होती।';
    }
    $('startGps').onclick = startTracking;
    $('stopGps').onclick = () => stopTracking();
    $('clearGps').onclick = () => { stopTracking('Tracking बंद है और reading मिटा दी गई है।'); clearReading(); };
    document.addEventListener('visibilitychange', () => {
        if(document.hidden) stopTracking('Page background में है; tracking बंद कर दी गई। वापस आने पर Start GPS दोबारा दबाएँ।');
    });
    window.addEventListener('pagehide', event => {
        stopTracking();
        if(!event.persisted) { disposed = true; if(permission) permission.onchange = null; clearReading(); }
    });
    window.addEventListener('online', showNetwork);
    window.addEventListener('offline', showNetwork);
    updateControls(); showNetwork(); inspectPermission();
})();
