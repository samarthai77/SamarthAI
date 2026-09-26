const { createClient } = require('@supabase/supabase-js');
const { getTool } = require('./tools');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GROQ_MODEL = 'openai/gpt-oss-20b';

function clip(value, max) {
  return String(value ?? '').slice(0, max);
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWeatherType(value) {
  const v = normalize(value);

  if (
    [
      'hourly',
      'hour',
      'hours',
      'ghante',
      'hour forecast'
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
      'future',
      'kal',
      'aane wale din'
    ].includes(v)
  ) {
    return 'daily';
  }

  return 'current';
}

function normalizeLocationMode(value) {
  const v = normalize(value);

  if (
    [
      'nearby',
      'near me',
      'near-me',
      'paas',
      'aas paas',
      'nazdeek'
    ].includes(v)
  ) {
    return 'nearby';
  }

  if (
    [
      'named',
      'city',
      'area',
      'place',
      'location_name'
    ].includes(v)
  ) {
    return 'named';
  }

  if (
    [
      'device',
      'gps',
      'phone',
      'current location'
    ].includes(v)
  ) {
    return 'device';
  }

  return 'none';
}

function memoryText(
  personal = [],
  family = []
) {
  const p = personal
    .slice(0, 25)
    .map(
      x =>
        `- ${clip(x.key, 80)}: ${clip(x.value, 250)}`
    )
    .join('\n');

  const f = family
    .slice(0, 25)
    .map(
      x =>
        `- ${clip(x.key, 80)}: ${clip(x.value, 250)}`
    )
    .join('\n');

  return (
    `PRIVATE PERSONAL MEMORY:\n` +
    `${p || '(none)'}\n\n` +
    `SHARED FAMILY MEMORY:\n` +
    `${f || '(none)'}`
  );
}

async function getFamilyMemory(userId) {
  const {
    data: member,
    error: me
  } = await supabase
    .from('family_members')
    .select('family_id,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (me) {
    throw me;
  }

  if (!member?.family_id) {
    return [];
  }

  const {
    data,
    error
  } = await supabase
    .from('family_memory')
    .select('key,value,updated_at')
    .eq(
      'family_id',
      member.family_id
    )
    .order(
      'updated_at',
      {
        ascending: false
      }
    )
    .limit(30);

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadContext(userId) {
  const [
    historyResult,
    personalResult,
    family
  ] = await Promise.all([
    supabase
      .from('chats')
      .select(
        'id,message,response,model,created_at'
      )
      .eq(
        'user_id',
        userId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      )
      .limit(100),

    supabase
      .from('personal_memory')
      .select(
        'id,key,value,updated_at'
      )
      .eq(
        'user_id',
        userId
      )
      .order(
        'updated_at',
        {
          ascending: false
        }
      )
      .limit(30),

    getFamilyMemory(userId)
  ]);

  if (historyResult.error) {
    throw historyResult.error;
  }

  if (personalResult.error) {
    throw personalResult.error;
  }

  return {
    history:
      historyResult.data || [],

    personal:
      personalResult.data || [],

    family:
      family || []
  };
}

function compactHistory(history) {
  const recent =
    history.slice(-10);

  if (!recent.length) {
    return '(no previous conversation)';
  }

  return recent
    .map(
      (item, i) =>
        `[${i + 1}] USER: ${clip(
          item.message,
          280
        )}\nASSISTANT: ${clip(
          item.response,
          450
        )}`
    )
    .join('\n\n');
}

function emptyPlan() {
  return {
    reply: '',
    mode: 'chat',
    exact_target: 'exchange',
    tool: 'none',
    action: 'none',

    arguments: {
      category: '',
      query: '',
      member_name: '',
      location_name: '',
      weather_type: 'current',
      location_mode: 'none'
    },

    memory_candidates: [],

    needs_web: false
  };
}

const conversationSchema = {
  type: 'object',

  additionalProperties: false,

  properties: {
    reply: {
      type: 'string'
    },

    mode: {
      type: 'string'
    },

    exact_target: {
      type: 'string'
    },

    tool: {
      type: 'string'
    },

    action: {
      type: 'string'
    },

    arguments: {
      type: 'object',

      additionalProperties: false,

      properties: {
        category: {
          type: 'string'
        },

        query: {
          type: 'string'
        },

        member_name: {
          type: 'string'
        },

        location_name: {
          type: 'string'
        },

        weather_type: {
          type: 'string'
        },

        location_mode: {
          type: 'string'
        }
      },

      required: [
        'category',
        'query',
        'member_name',
        'location_name',
        'weather_type',
        'location_mode'
      ]
    },

    memory_candidates: {
      type: 'array',

      items: {
        type: 'object',

        additionalProperties: false,

        properties: {
          key: {
            type: 'string'
          },

          value: {
            type: 'string'
          },

          explicit: {
            type: 'boolean'
          },

          evidence: {
            type: 'string'
          }
        },

        required: [
          'key',
          'value',
          'explicit',
          'evidence'
        ]
      }
    },

    needs_web: {
      type: 'boolean'
    }
  },

  required: [
    'reply',
    'mode',
    'exact_target',
    'tool',
    'action',
    'arguments',
    'memory_candidates',
    'needs_web'
  ]
};

async function understandAndAnswer(
  message,
  context
) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is not configured'
    );
  }

  const prompt = `
You are SamarthAI's main conversation engine.

Understand meaning, context and references.

Do not use keyword lists or regex logic.

Understand:

- Hindi
- Roman Hindi
- Hinglish
- English
- Devanagari
- spelling mistakes
- short replies
- incomplete sentences
- references to previous conversation

Never invent facts.

Return ONLY JSON matching the supplied schema.

TOOLS:

none
weather
family
gps
services

MODES:

chat
exact_previous
recent_history
history_summary

WEATHER:

Use current, hourly or daily.

If user names a city or area:

location_mode = named

and put the place name in:

location_name

If user asks nearby services:

location_mode = nearby

If usable device coordinates are supplied:

location_mode = device

SERVICES:

Put requested service type in:

category

or:

query

GPS:

member_name may contain a person's name
or family relation.

MEMORY:

Create candidates only for durable facts
or preferences explicitly stated by the user
in THIS message.

explicit must be true.

evidence must be an exact substring
of the current user message.

Never create memory from questions,
guesses or assistant information.

CURRENT USER MESSAGE:

${clip(
  message,
  2000
)}

RECENT CONVERSATION:

${compactHistory(
  context.history
)}

MEMORY:

${memoryText(
  context.personal,
  context.family
)}
`;

  const response =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`,

          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          model:
            GROQ_MODEL,

          messages: [
            {
              role: 'system',

              content:
                'Return only valid JSON. No markdown.'
            },

            {
              role: 'user',

              content:
                prompt
            }
          ],

          response_format: {
            type: 'json_schema',

            json_schema: {
              name:
                'samarthai_conversation',

              strict: true,

              schema:
                conversationSchema
            }
          },

          include_reasoning:
            false,

          temperature:
            0.1,

          max_completion_tokens:
            900
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      'Conversation AI request failed'
    );
  }

  const raw =
    data
      ?.choices?.[0]
      ?.message?.content ||
    '{}';

  let parsed;

  try {
    parsed =
      JSON.parse(raw);
  } catch (error) {
    console.error(
      'Conversation JSON parse error:',
      raw
    );

    return emptyPlan();
  }

  const plan = {
    ...emptyPlan(),
    ...parsed
  };

  plan.arguments = {
    ...emptyPlan().arguments,
    ...(parsed.arguments || {})
  };
// Normalize AI-generated semantic values
  // on the server side instead of trusting
  // strict enum values from the model.

  plan.arguments.weather_type =
    normalizeWeatherType(
      plan.arguments.weather_type
    );

  plan.arguments.location_mode =
    normalizeLocationMode(
      plan.arguments.location_mode
    );

  return plan;
}


// =====================================================
// SAVE PERSONAL MEMORY
// =====================================================

async function saveMemory(
  userId,
  candidates,
  userMessage
) {
  if (!Array.isArray(candidates)) {
    return [];
  }

  const source =
    normalize(userMessage);

  const saved = [];

  for (
    const item of candidates.slice(0, 5)
  ) {
    if (
      !item ||
      item.explicit !== true
    ) {
      continue;
    }

    const key =
      clip(item.key, 100).trim();

    const value =
      clip(item.value, 500).trim();

    const evidence =
      normalize(item.evidence);

    if (
      !key ||
      !value ||
      !evidence
    ) {
      continue;
    }

    // Evidence must actually exist
    // inside the current user message.
    if (!source.includes(evidence)) {
      continue;
    }

    const {
      data: existing,
      error: findError
    } = await supabase
      .from('personal_memory')
      .select('id')
      .eq(
        'user_id',
        userId
      )
      .eq(
        'key',
        key
      )
      .limit(1)
      .maybeSingle();

    if (findError) {
      console.error(
        'Memory lookup error:',
        findError
      );

      continue;
    }

    if (existing?.id) {
      const {
        error
      } = await supabase
        .from('personal_memory')
        .update({
          value,
          updated_at:
            new Date().toISOString()
        })
        .eq(
          'id',
          existing.id
        );

      if (error) {
        console.error(
          'Memory update error:',
          error
        );

        continue;
      }
    } else {
      const {
        error
      } = await supabase
        .from('personal_memory')
        .insert([
          {
            user_id:
              userId,

            key,

            value
          }
        ]);

      if (error) {
        console.error(
          'Memory insert error:',
          error
        );

        continue;
      }
    }

    saved.push({
      key,
      value
    });
  }

  return saved;
}


// =====================================================
// EXACT HISTORY
// =====================================================

function formatHistory(
  history,
  target
) {
  if (!history.length) {
    return (
      'Abhi koi pichhli conversation available nahi hai.'
    );
  }

  const previous =
    history[
      history.length - 1
    ];

  if (
    target === 'user'
  ) {
    return (
      `Aapka pichhla message tha: "${previous.message || ''}"`
    );
  }

  if (
    target === 'assistant'
  ) {
    return (
      `Mera pichhla jawab tha: "${previous.response || ''}"`
    );
  }

  return (
    `Pichhla exchange:\n` +
    `Aap: ${previous.message || ''}\n` +
    `SamarthAI: ${previous.response || ''}`
  );
}


// =====================================================
// RECENT HISTORY
// =====================================================

function formatRecentHistory(
  history
) {
  if (!history.length) {
    return (
      'Abhi koi pichhli conversation available nahi hai.'
    );
  }

  return history
    .slice(-12)
    .map(
      (item, index) =>
        `${index + 1}. ` +
        `Aap: ${item.message || ''}\n` +
        `SamarthAI: ${item.response || ''}`
    )
    .join('\n\n');
}


// =====================================================
// HISTORY SUMMARY
// =====================================================

function formatHistorySummary(
  history
) {
  if (!history.length) {
    return (
      'Abhi koi pichhli conversation available nahi hai.'
    );
  }

  return history
    .slice(-12)
    .map(
      item =>
        `User: ${item.message || ''}\n` +
        `SamarthAI: ${item.response || ''}`
    )
    .join('\n\n');
}


// =====================================================
// EXECUTE TOOL
// =====================================================

async function executeTool(
  plan,
  userId,
  location
) {
  const toolName =
    normalize(plan?.tool) ||
    'none';

  const args =
    plan?.arguments ||
    {};

  if (
    toolName === 'none'
  ) {
    return null;
  }

  const tool =
    getTool(toolName);

  if (!tool) {
    return {
      error:
        `Tool "${toolName}" is not available.`
    };
  }

// ===================================================
  // WEATHER
  // ===================================================

  if (
    toolName === 'weather'
  ) {
    const namedLocation =
      String(
        args.location_name || ''
      ).trim();

    if (namedLocation) {
      return tool.execute({
        locationName:
          namedLocation,

        type:
          args.weather_type ||
          'current'
      });
    }

    if (
      location?.latitude == null ||
      location?.longitude == null
    ) {
      return {
        needs_location:
          true
      };
    }

    return tool.execute({
      latitude:
        location.latitude,

      longitude:
        location.longitude,

      type:
        args.weather_type ||
        'current'
    });
  }


  // ===================================================
  // FAMILY
  // ===================================================

  if (
    toolName === 'family'
  ) {
    return tool.execute(
      userId
    );
  }


  // ===================================================
  // SERVICES
  // ===================================================

  if (
    toolName === 'services'
  ) {
    const nearby =
      args.location_mode ===
      'nearby';

    if (
      nearby &&
      (
        location?.latitude == null ||
        location?.longitude == null
      )
    ) {
      return {
        needs_location:
          true
      };
    }

    return tool.execute({
      query:
        args.query || '',

      category:
        args.category || '',

      location:
        args.location_name || '',

      latitude:
        location?.latitude ?? null,

      longitude:
        location?.longitude ?? null,

      nearby,

      limit:
        10
    });
  }


  // ===================================================
  // GPS
  // ===================================================

  if (
    toolName === 'gps'
  ) {
    return {
      needs_member:
        true,

      member_name:
        args.member_name || ''
    };
  }


  return {
    error:
      `Unsupported tool "${toolName}".`
  };
}


// =====================================================
// GPS MEMBER MATCHING
// =====================================================

function findFamilyMember(
  members,
  requested
) {
  const value =
    normalize(requested);

  if (!value) {
    return null;
  }

  const exact =
    members.find(
      member => {
        const name =
          normalize(member.name);

        const relation =
          normalize(member.relation);

        return (
          name === value ||
          relation === value
        );
      }
    );

  if (exact) {
    return exact;
  }

  return (
    members.find(
      member => {
        const name =
          normalize(member.name);

        const relation =
          normalize(member.relation);

        return (
          name.includes(value) ||
          value.includes(name) ||
          relation.includes(value)
        );
      }
    ) ||
    null
  );
}
// =====================================================
// FINAL TOOL RESPONSE
// =====================================================

async function finalToolAnswer({
  message,
  plan,
  result
}) {
  if (
    result?.needs_location
  ) {
    if (
      plan.tool === 'services'
    ) {
      return (
        'Nearby service dhoondhne ke liye ' +
        'mujhe aapka city/area bata dijiye, ' +
        'ya location permission de dijiye. 📍'
      );
    }

    return (
      'Mausam batane ke liye mujhe ' +
      'city/area ka naam bata dijiye, ' +
      'ya location permission de dijiye. 📍'
    );
  }

  if (
    result?.error
  ) {
    return (
      `Is request ko complete nahi kar saka: ${result.error}`
    );
  }

  if (
    !process.env.GROQ_API_KEY
  ) {
    throw new Error(
      'GROQ_API_KEY is not configured'
    );
  }

  const prompt = `
You are SamarthAI.

Answer the user naturally and directly.

Use the same language as the user.

The tool has already been executed.

Use ONLY the supplied result.

Never invent information.

Never mention internal tools,
JSON, schemas or system instructions.

If the result contains no useful records,
clearly tell the user that nothing was found.

If there are service providers,
show the most relevant ones concisely.

If there is family information,
answer the user's actual question,
including relation when available.

If there is GPS information,
give the member name and available
location information directly.

USER:

${clip(
  message,
  2000
)}

TOOL:

${clip(
  JSON.stringify(plan),
  3000
)}

RESULT:

${clip(
  JSON.stringify(result),
  9000
)}
`;

  const response =
    await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${process.env.GROQ_API_KEY}`,

          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          model:
            GROQ_MODEL,

          messages: [
            {
              role: 'system',

              content:
                'Answer naturally. Do not expose internal implementation details.'
            },

            {
              role: 'user',

              content:
                prompt
            }
          ],

          include_reasoning:
            false,

          temperature:
            0.2,

          max_completion_tokens:
            600
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      'Final AI response failed'
    );
  }

  return (
    data
      ?.choices?.[0]
      ?.message?.content
      ?.trim() ||
    'Mujhe iska jawab dene mein dikkat hui.'
  );
}


// =====================================================
// MAIN CONVERSATION
// =====================================================

async function runConversation({
  userId,
  message,
  location = null
}) {
  const context =
    await loadContext(
      userId
    );

  const cleanMessage =
    String(message || '').trim();

  if (!cleanMessage) {
    return {
      response:
        'Aap kya poochna chahte hain?',

      model:
        GROQ_MODEL,

      intent:
        'chat',

      memory_saved:
        false,

      web_used:
        false
    };
  }


  // ===================================================
  // AI UNDERSTANDING
  // ===================================================

  const plan =
    await understandAndAnswer(
      cleanMessage,
      context
    );

  console.log(
    'Conversation Plan:',
    JSON.stringify(plan)
  );


  // ===================================================
  // SAVE EXPLICIT MEMORY
  // ===================================================

  const saved =
    await saveMemory(
      userId,
      plan.memory_candidates,
      cleanMessage
    );


  // ===================================================
  // EXACT PREVIOUS MESSAGE
  // ===================================================

  if (
    plan.mode ===
    'exact_previous'
  ) {
    return {
      response:
        formatHistory(
          context.history,
          plan.exact_target
        ),

      model:
        GROQ_MODEL,

      intent:
        'history',

      memory_saved:
        saved.length > 0,

      web_used:
        false
    };
  }


  // ===================================================
  // RECENT HISTORY
  // ===================================================

  if (
    plan.mode ===
    'recent_history'
  ) {
    return {
      response:
        formatRecentHistory(
          context.history
        ),

      model:
        GROQ_MODEL,

      intent:
        'history',

      memory_saved:
        saved.length > 0,

      web_used:
        false
    };
  }


  // ===================================================
  // HISTORY SUMMARY
  // ===================================================

  if (
    plan.mode ===
    'history_summary'
  ) {
    return {
      response:
        formatHistorySummary(
          context.history
        ),

      model:
        GROQ_MODEL,

      intent:
        'history',

      memory_saved:
        saved.length > 0,

      web_used:
        false
    };
  }


  // ===================================================
  // NORMAL CHAT
  // ===================================================

  if (
    !plan.tool ||
    plan.tool === 'none'
  ) {
    return {
      response:
        plan.reply ||
        'Ji, bataiye.',

      model:
        GROQ_MODEL,

      intent:
        'chat',

      memory_saved:
        saved.length > 0,

      web_used:
        false
    };
  }


  // ===================================================
  // TOOL EXECUTION
  // ===================================================

  let toolResult;

  try {
    toolResult =
      await executeTool(
        plan,
        userId,
        location
      );
  } catch (error) {
    console.error(
      'Conversation tool error:',
      error
    );

    return {
      response:
        'Is request ko process karte waqt problem aa gayi. Kripya dobara try karein.',

      model:
        plan.tool,

      intent:
        plan.tool,

      memory_saved:
        saved.length > 0,

      web_used:
        false
    };
  }


  // ===================================================
  // GPS MEMBER RESOLUTION
  // ===================================================

  if (
    toolResult?.needs_member
  ) {
    const requested =
      normalize(
        plan.arguments?.member_name
      );

    if (!requested) {
      return {
        response:
          'Kis family member ki location dekhni hai?',

        model:
          GROQ_MODEL,

        intent:
          'gps',

        memory_saved:
          saved.length > 0,

        web_used:
          false
      };
    }

    let family;

    try {
      family =
        await getTool(
          'family'
        ).execute(
          userId
        );
    } catch (error) {
      console.error(
        'Family lookup error:',
        error
      );

      return {
        response:
          'Family members ki information nahi mil paayi.',

        model:
          'family',

        intent:
          'gps',

        memory_saved:
          saved.length > 0,

        web_used:
          false
      };
    }

    const member =
      findFamilyMember(
        family?.members || [],
        requested
      );

    if (!member) {
      const names =
        (family?.members || [])
          .map(
            item =>
              item.name
          )
          .filter(Boolean)
          .join(', ');

      return {
        response:
          names
            ? `"${plan.arguments.member_name}" nahi mila. Family members: ${names}`
            : `"${plan.arguments.member_name}" family member nahi mila.`,

        model:
          GROQ_MODEL,

        intent:
          'gps',

        memory_saved:
          saved.length > 0,

        web_used:
          false
      };
    }

    try {
      toolResult =
        await getTool(
          'gps'
        ).execute({
          userId,

          memberId:
            member.id
        });
    } catch (error) {
      console.error(
        'GPS tool error:',
        error
      );

      return {
        response:
          'Is family member ki location abhi available nahi hai.',

        model:
          'gps',

        intent:
          'gps',

        memory_saved:
          saved.length > 0,

        web_used:
          false
      };
    }
  }


  // ===================================================
  // FINAL NATURAL LANGUAGE RESPONSE
  // ===================================================

  const response =
    await finalToolAnswer({
      message:
        cleanMessage,

      plan,

      result:
        toolResult
    });

  return {
    response,

    model:
      GROQ_MODEL,

    intent:
      plan.tool,

    memory_saved:
      saved.length > 0,

    web_used:
      Boolean(
        plan.needs_web
      )
  };
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  runConversation
};
  
