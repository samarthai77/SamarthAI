const {
  createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getServices(userId) {
  if (!userId) {
    throw new Error(
      'User ID is required'
    );
  }

  const {
    data,
    error
  } = await supabase
    .from('services')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {
      ascending: false
    });

  if (error) {
    throw error;
  }

  return data || [];
}

module.exports = {
  name: 'services',
  description: 'Read the user service profiles',
  readOnly: true,
  execute: getServices
};
