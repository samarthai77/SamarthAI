const {
  createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getFamily(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const {
    data: membership,
    error: membershipError
  } = await supabase
    .from('family_members')
    .select(
      'id,user_id,family_id,name,role,is_active'
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership?.family_id) {
    return {
      family: null,
      members: [],
      currentUserRole: null
    };
  }

  const {
    data: family,
    error: familyError
  } = await supabase
    .from('families')
    .select(
      'id,name,created_by,created_at'
    )
    .eq(
      'id',
      membership.family_id
    )
    .maybeSingle();

  if (familyError) {
    throw familyError;
  }

  const {
    data: members,
    error: membersError
  } = await supabase
    .from('family_members')
    .select(
      'id,user_id,family_id,name,phone,location,last_updated,created_at,relation,role,is_active'
    )
    .eq(
      'family_id',
      membership.family_id
    )
    .eq('is_active', true)
    .order('created_at', {
      ascending: true
    });

  if (membersError) {
    throw membersError;
  }

  return {
    family: family || null,
    members: members || [],
    currentUserRole:
      membership.role || 'member'
  };
}

module.exports = {
  name: 'family',
  description: 'Read family information',
  readOnly: true,
  execute: getFamily
};
