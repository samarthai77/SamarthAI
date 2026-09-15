const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_WEATHER_API_KEY =
    process.env.GOOGLE_WEATHER_API_KEY;

function getUserId(req) {
    const token =
        req.headers.authorization?.split(' ')[1];

    if (!token) return null;

    try {
        const decoded =
            jwt.verify(token, JWT_SECRET);

        return decoded?.id || null;
    } catch (error) {
        console.error(
            'Weather JWT error:',
            error.message
        );

        return null;
    }
}

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
        console.error(
            'Google Weather API error:',
            response.status,
            JSON.stringify(data)
        );

        throw new Error(
            data?.error?.message ||
            'Google Weather API request failed'
        );
    }

    return data;
}


// =====================================================
// WEATHER
// =====================================================

router.get('/', async (req, res) => {

    const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({
            error: 'Unauthorized'
        });
    }

    if (!GOOGLE_WEATHER_API_KEY) {
        return res.status(503).json({
            error:
                'Weather service is not configured yet.',
            code:
                'MISSING_GOOGLE_WEATHER_API_KEY'
        });
    }

    const {
        latitude,
        longitude,
        type = 'current'
    } = req.query;

    if (
        !validCoordinate(latitude, -90, 90) ||
        !validCoordinate(longitude, -180, 180)
    ) {
        return res.status(400).json({
            error:
                'Valid latitude and longitude are required.'
        });
    }

    try {

        // CURRENT WEATHER
        if (type === 'current') {

            const data =
                await googleWeather(
                    'currentConditions:lookup',
                    latitude,
                    longitude
                );

            return res.json({
                success: true,
                type: 'current',
                data
            });
        }


        // HOURLY WEATHER
        if (type === 'hourly') {

            const data =
                await googleWeather(
                    'forecast/hours:lookup',
                    latitude,
                    longitude,
                    '&hours=24'
                );

            return res.json({
                success: true,
                type: 'hourly',
                data
            });
        }


        // DAILY WEATHER
        if (type === 'daily') {

            const data =
                await googleWeather(
                    'forecast/days:lookup',
                    latitude,
                    longitude,
                    '&days=7'
                );

            return res.json({
                success: true,
                type: 'daily',
                data
            });
        }


        return res.status(400).json({
            error: 'Invalid weather type.'
        });

    } catch (error) {

        console.error(
            'Weather route error:',
            error.message
        );

        return res.status(502).json({
            error:
                'Live weather service unavailable right now.'
        });
    }
});


module.exports = router;
