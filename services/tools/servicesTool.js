const {
  createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);


// =====================================================
// SEARCH SERVICES
// =====================================================

async function searchServices({
  query = '',
  category = '',
  location = '',
  limit = 10
} = {}) {

  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    20
  );

  const cleanQuery =
    String(query || '')
      .trim()
      .toLowerCase();

  const cleanCategory =
    String(category || '')
      .trim()
      .toLowerCase();

  const cleanLocation =
    String(location || '')
      .trim()
      .toLowerCase();


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
      users(name, profile_photo_url)
    `)
    .eq('is_active', true)
    .order('created_at', {
      ascending: false
    })
    .limit(100);


  if (error) {
    throw error;
  }


  let services = data || [];


  // ===================================================
  // CATEGORY FILTER
  // ===================================================

  if (cleanCategory) {

    services = services.filter(service => {

      const value =
        String(service.category || '')
          .toLowerCase();

      return value.includes(cleanCategory);
    });
  }


  // ===================================================
  // LOCATION FILTER
  // ===================================================

  if (cleanLocation) {

    services = services.filter(service => {

      const value =
        String(service.location || '')
          .toLowerCase();

      return value.includes(cleanLocation);
    });
  }


  // ===================================================
  // TEXT SEARCH
  // ===================================================

  if (cleanQuery) {

    services = services.filter(service => {

      const searchable = [
        service.title,
        service.description,
        service.category,
        service.location
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(cleanQuery);
    });
  }


  // ===================================================
  // SAFE RESPONSE
  // ===================================================

  return services
    .slice(0, safeLimit)
    .map(service => {

      return {
        id: service.id,

        provider_id:
          service.user_id,

        provider_name:
          service.users?.name ||
          'Service Provider',

        provider_photo_url:
          service.users?.profile_photo_url ||
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

        is_active:
          service.is_active
      };
    });
}


// =====================================================
// TOOL
// =====================================================

module.exports = {

  name: 'services',

  description:
    'Search active SamarthAI service providers',

  readOnly: true,

  execute:
    searchServices
};
