const GOOGLE_WEATHER_API_KEY =
  process.env.GOOGLE_WEATHER_API_KEY;


// =====================================================
// COORDINATE VALIDATION
// =====================================================

function validCoordinate(
  value,
  min,
  max
) {
  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number >= min &&
    number <= max
  );
}


// =====================================================
// WEATHER TYPE NORMALIZATION
// =====================================================

function normalizeType(
  value
) {
  const v =
    String(
      value || ''
    )
      .toLowerCase()
      .trim();

  if (
    [
      'hourly',
      'hour',
      'hours'
    ].includes(v)
  ) {
    return 'hourly';
  }

  if (
    [
      'daily',
      'day',
      'days',
      'tomorrow',
      'forecast',
      'future'
    ].includes(v)
  ) {
    return 'daily';
  }

  return 'current';
}


// =====================================================
// LOCATION / CITY LOOKUP
// =====================================================

async function geocodePlace(
  locationName
) {
  const name =
    String(
      locationName || ''
    ).trim();

  if (!name) {
    throw new Error(
      'Location name is required'
    );
  }

  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(name)}` +
    '&count=1' +
    '&language=en' +
    '&format=json';

  const response =
    await fetch(url);

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.reason ||
      'Location lookup failed'
    );
  }

  const place =
    data?.results?.[0];

  if (!place) {
    throw new Error(
      `Location "${name}" was not found`
    );
  }

  return {
    latitude:
      place.latitude,

    longitude:
      place.longitude,

    name:
      place.name,

    country:
      place.country,

    admin1:
      place.admin1 ||
      null
  };
}


// =====================================================
// GOOGLE WEATHER API
// =====================================================

async function googleWeather(
  endpoint,
  latitude,
  longitude,
  extraParams = ''
) {
  if (
    !GOOGLE_WEATHER_API_KEY
  ) {
    throw new Error(
      'GOOGLE_WEATHER_API_KEY is not configured'
    );
  }

  const url =
    `https://weather.googleapis.com/v1/${endpoint}` +
    `?key=${encodeURIComponent(
      GOOGLE_WEATHER_API_KEY
    )}` +
    `&location.latitude=${encodeURIComponent(
      latitude
    )}` +
    `&location.longitude=${encodeURIComponent(
      longitude
    )}` +
    '&units_system=METRIC' +
    extraParams;

  const response =
    await fetch(url);

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      'Weather API request failed'
    );
  }

  return data;
}


// =====================================================
// MAIN WEATHER FUNCTION
// =====================================================

async function getWeather({
  latitude,
  longitude,
  locationName,
  type = 'current'
} = {}) {

  let resolved =
    null;


  // ===================================================
  // EXPLICIT CITY / AREA
  // ===================================================

  if (
    locationName
  ) {
    resolved =
      await geocodePlace(
        locationName
      );

    latitude =
      resolved.latitude;

    longitude =
      resolved.longitude;
  }


  // ===================================================
  // VALIDATE COORDINATES
  // ===================================================

  if (
    !validCoordinate(
      latitude,
      -90,
      90
    ) ||
    !validCoordinate(
      longitude,
      -180,
      180
    )
  ) {
    throw new Error(
      'Valid latitude and longitude are required'
    );
  }


  const weatherType =
    normalizeType(
      type
    );


  let data;


  // ===================================================
  // HOURLY
  // ===================================================

  if (
    weatherType ===
    'hourly'
  ) {
    data =
      await googleWeather(
        'forecast/hours:lookup',
        latitude,
        longitude,
        '&hours=24'
      );
  }


  // ===================================================
  // DAILY
  // ===================================================

  else if (
    weatherType ===
    'daily'
  ) {
    data =
      await googleWeather(
        'forecast/days:lookup',
        latitude,
        longitude,
        '&days=7'
      );
  }


  // ===================================================
  // CURRENT
  // ===================================================

  else {
    data =
      await googleWeather(
        'currentConditions:lookup',
        latitude,
        longitude
      );
  }


  // ===================================================
  // SAFE RESPONSE
  // ===================================================

  return {
    location:
      resolved || {
        latitude,
        longitude
      },

    type:
      weatherType,

    data
  };
}


// =====================================================
// TOOL EXPORT
// =====================================================

module.exports = {
  name:
    'weather',

  description:
    'Get live weather information',

  readOnly:
    true,

  execute:
    getWeather
};
