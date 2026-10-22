/* Local destination preparation only. No provider, routing, geocoding or location access. */
(() => {
    'use strict';
    const destination = document.getElementById('destinationDraft');
    const preference = document.getElementById('travelPreference');
    const message = document.getElementById('destinationStatus');
    const clear = document.getElementById('clearDestination');
    function status(text, error = false) {
        message.textContent = text;
        message.classList.toggle('error', error);
    }
    function clearDraft() {
        destination.value = '';
        preference.value = 'driving';
        clear.disabled = true;
        status('कोई destination draft नहीं है। कोई route, distance या ETA नहीं निकाला गया है।');
    }
    function prepareDraft() {
        const name = destination.value.trim();
        if(name.length < 3 || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) {
            status('Destination के लिए 3–200 characters का नाम या पता लिखें।', true);
            destination.focus();
            return;
        }
        const mode = preference.value === 'walking' ? 'Walking' : 'Driving';
        clear.disabled = false;
        status('केवल local draft: ' + name + '\nयात्रा की पसंद: ' + mode + '\nपता search या verify नहीं हुआ है। Navigation शुरू नहीं हुई है।');
    }
    function draftChanged() {
        clear.disabled = destination.value.length === 0 && preference.value === 'driving';
        status('यह input केवल device पर है। Local draft तैयार करें; कोई search request नहीं भेजी जाएगी।');
    }
    destination.addEventListener('input', draftChanged);
    preference.addEventListener('change', draftChanged);
    destination.addEventListener('keydown', event => {
        if(event.key === 'Enter' && !event.isComposing) { event.preventDefault(); prepareDraft(); }
    });
    document.getElementById('prepareDestination').addEventListener('click', prepareDraft);
    clear.addEventListener('click', clearDraft);
    window.addEventListener('pagehide', clearDraft);
    // Do not restore a destination via form restoration on a fresh page load.
    window.addEventListener('pageshow', event => { if(!event.persisted) clearDraft(); });
    clearDraft();
})();
