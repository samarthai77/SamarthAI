/* =====================================================
   SAMARTHAI CENTRAL LANGUAGE CONFIG
   Single source of truth for language support
===================================================== */

window.SAMARTHAI_LANGUAGES = [
    {
        code: 'hi-IN',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        enabled: true
    },

    {
        code: 'en-US',
        name: 'English',
        nativeName: 'English',
        enabled: true
    },

    {
        code: 'bn-IN',
        name: 'Bengali',
        nativeName: 'বাংলা',
        enabled: true
    },

    {
        code: 'mr-IN',
        name: 'Marathi',
        nativeName: 'मराठी',
        enabled: true
    },

    {
        code: 'gu-IN',
        name: 'Gujarati',
        nativeName: 'ગુજરાતી',
        enabled: true
    },

    {
        code: 'ta-IN',
        name: 'Tamil',
        nativeName: 'தமிழ்',
        enabled: true
    },

    {
        code: 'te-IN',
        name: 'Telugu',
        nativeName: 'తెలుగు',
        enabled: true
    },

    {
        code: 'kn-IN',
        name: 'Kannada',
        nativeName: 'ಕನ್ನಡ',
        enabled: true
    },

    {
        code: 'ml-IN',
        name: 'Malayalam',
        nativeName: 'മലയാളം',
        enabled: true
    },

    {
        code: 'pa-IN',
        name: 'Punjabi',
        nativeName: 'ਪੰਜਾਬੀ',
        enabled: true
    }
];


/* =====================================================
   LANGUAGE HELPERS
===================================================== */

function getSamarthAILanguages(){

    return Array.isArray(
        window.SAMARTHAI_LANGUAGES
    )
        ? window.SAMARTHAI_LANGUAGES.filter(
            language => language.enabled !== false
        )
        : [];

}


function getSamarthAILanguage(code){

    return getSamarthAILanguages().find(
        language =>
            language.code === code
    ) || null;

}


function getSamarthAILanguageName(code){

    const language =
        getSamarthAILanguage(code);

    if(!language){
        return code || 'Hindi';
    }

    return (
        language.nativeName +
        ' — ' +
        language.name
    );

}
