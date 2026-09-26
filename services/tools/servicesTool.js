const {
  createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);


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
// DISTANCE CALCULATION
// HAVERSINE FORMULA
// =====================================================

function distanceKm(
  lat1,
  lon1,
  lat2,
  lon2
) {
  const R =
    6371;

  const toRad =
    value =>
      (
        Number(value) *
        Math.PI
      ) / 180;

  const dLat =
    toRad(
      Number(lat2) -
      Number(lat1)
    );

  const dLon =
    toRad(
      Number(lon2) -
      Number(lon1)
    );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      toRad(lat1)
    ) *
      Math.cos(
        toRad(lat2)
      ) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    R *
    Math.asin(
      Math.sqrt(a)
    )
  );
}


// =====================================================
// SEARCH SERVICES
// =====================================================

async function searchServices({
  query = '',
  category = '',
  location = '',
  latitude = null,
  longitude = null,
  nearby = false,
  limit = 10
} = {}) {

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 10,
        1
      ),
      20
    );


  const cleanQuery =
    String(
      query || ''
    )
      .trim()
      .toLowerCase();


  const cleanCategory =
    String(
      category || ''
    )
      .trim()
      .toLowerCase();


  const cleanLocation =
    String(
      location || ''
    )
      .trim()
      .toLowerCase();


  // ===================================================
  // DATABASE
  // ===================================================

  const {
    data,
    error
  } = await supabase
    .from('services')
    .select(`
      id,
      user_id,
      title,
      description,
      price,
      category,
      location,
      latitude,
      longitude,
      is_active,
      created_at,
      users(
        name,
        profile_photo_url
      )
    `)
    .eq(
      'is_active',
      true
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(200);


  if (error) {
    throw error;
  }


  let services =
    data || [];


  // ===================================================
  // CATEGORY FILTER
  // ===================================================

  if (
    cleanCategory
  ) {
    services =
      services.filter(
        service => {

          const value =
            String(
              service.category ||
              ''
            )
              .toLowerCase();

          return value.includes(
            cleanCategory
          );
        }
      );
  }


  // ===================================================
  // LOCATION FILTER
  // ===================================================

  if (
    cleanLocation
  ) {
    services =
      services.filter(
        service => {

          const value =
            String(
              service.location ||
              ''
            )
              .toLowerCase();

          return value.includes(
            cleanLocation
          );
        }
      );
  }


  // ===================================================
  // TEXT SEARCH
  // ===================================================

  if (
    cleanQuery
  ) {
    services =
      services.filter(
        service => {

          const searchable = [
            service.title,
            service.description,
            service.category,
            service.location
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return searchable.includes(
            cleanQuery
          );
        }
      );
  }


  // ===================================================
  // NEARBY SEARCH
  // ===================================================

  if (
    nearby
  ) {

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
      return [];
    }


    services =
      services
        .filter(
          service =>
            validCoordinate(
              service.latitude,
              -90,
              90
            ) &&
            validCoordinate(
              service.longitude,
              -180,
              180
            )
        )
        .map(
          service => ({
            service,

            distance_km:
              distanceKm(
                latitude,
                longitude,
                service.latitude,
                service.longitude
              )
          })
        )
        .filter(
          item =>
            item.distance_km <= 50
        )
        .sort(
          (a, b) =>
            a.distance_km -
            b.distance_km
        )
        .slice(
          0,
          safeLimit
        )
        .map(
          item => ({
            ...item.service,

            distance_km:
              Number(
                item.distance_km.toFixed(
                  2
                )
              )
          })
        );

  } else {

    services =
      services.slice(
        0,
        safeLimit
      );
  }


  // ===================================================
  // SAFE RESPONSE
  // ===================================================

  return services.map(
    service => ({
      id:
        service.id,

      provider_id:
        service.user_id,

      provider_name:
        service.users?.name ||
        'Service Provider',

      provider_photo_url:
        service.users
          ?.profile_photo_url ||
        null,

      title:
        service.title,

      description:
        service.description,

      price:
        service.price,

      category:
        service.category,

      location:
        service.location,

      latitude:
        service.latitude,

      longitude:
        service.longitude,

      distance_km:
        service.distance_km ??
        null,

      is_active:
        service.is_active
    })
  );
}


// =====================================================
// TOOL EXPORT
// =====================================================

module.exports = {
  name:
    'services',

  description:
    'Search active SamarthAI service providers',

  readOnly:
    true,

  execute:
    searchServices
};
