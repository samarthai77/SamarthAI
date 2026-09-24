const GOOGLE_WEATHER_API_KEY =
  process.env.GOOGLE_WEATHER_API_KEY;

function validCoordinate(value, min, max) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number >= min &&
    number <= max
  );
}

async function googleWeather(
  endpoint,
  latitude,
  longitude,
  extraParams = ''
) {
  if (!GOOGLE_WEATHER_API_KEY) {
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
    `&units_system=METRIC` +
    extraParams;

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      'Weather API request failed'
    );
  }

  return data;
}

async function getWeather({
  latitude,
  longitude,
  type = 'current'
}) {
  if (
    !validCoordinate(latitude, -90, 90) ||
    !validCoordinate(longitude, -180, 180)
  ) {
    throw new Error(
      'Valid latitude and longitude are required'
    );
  }

  if (type === 'current') {
    return googleWeather(
      'currentConditions:lookup',
      latitude,
      longitude
    );
  }

  if (type === 'hourly') {
    return googleWeather(
      'forecast/hours:lookup',
      latitude,
      longitude,
      '&hours=24'
    );
  }

  if (type === 'daily') {
    return googleWeather(
      'forecast/days:lookup',
      latitude,
      longitude,
      '&days=7'
    );
  }

  throw new Error(
    'Invalid weather type'
  );
}

module.exports = {
  name: 'weather',
  description: 'Get live weather information',
  readOnly: true,
  execute: getWeather
};
