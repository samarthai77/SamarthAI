const {
  createClient
} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getMemberLocation({
  userId,
  memberId
}) {
  if (!userId) {
    throw new Error(
      'User ID is required'
    );
  }

  if (!memberId) {
    throw new Error(
      'Member ID is required'
    );
  }

  const {
    data: currentMember,
    error: currentError
  } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!currentMember?.family_id) {
    throw new Error(
      'Your family membership was not found'
    );
  }

  const {
    data: member,
    error: memberError
  } = await supabase
    .from('family_members')
    .select(
      'id,family_id,name,location,last_updated'
    )
    .eq('id', memberId)
    .eq(
      'family_id',
      currentMember.family_id
    )
    .eq('is_active', true)
    .maybeSingle();

  if (memberError) {
    throw memberError;
  }

  if (!member) {
    throw new Error(
      'Family member not found'
    );
  }

  return {
    memberId: member.id,
    name: member.name,
    location: member.location,
    last_updated: member.last_updated
  };
}

module.exports = {
  name: 'gps',
  description: 'Read family member GPS location',
  readOnly: true,
  execute: getMemberLocation
};
