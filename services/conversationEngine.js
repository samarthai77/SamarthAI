const { createClient } = require('@supabase/supabase-js');
const { getTool } = require('./tools');
const { callGroq, callOpenAI } = require('./aiGateway');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const GROQ_MODEL = 'openai/gpt-oss-20b';


// =====================================================
// MEMORY TEXT
// =====================================================

function memoryText(personal = [], family = []) {

  const personalText =
    personal
      .map(item =>
        `- ${item.key}: ${String(item.value ?? '')}`
      )
      .join('\n');

  const familyText =
    family
      .map(item =>
        `- ${item.key}: ${String(item.value ?? '')}`
      )
      .join('\n');

  return `
PRIVATE PERSONAL MEMORY:
${personalText || '(none)'}

SHARED FAMILY MEMORY:
${familyText || '(none)'}
`;
}


// =====================================================
// FAMILY MEMORY
// =====================================================

async function getFamilyMemory(userId) {

  const {
    data: member,
    error: memberError
  } = await supabase
    .from('family_members')
    .select('family_id,is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (memberError) {
    throw memberError;
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
    .eq('family_id', member.family_id)
    .order('updated_at', {
      ascending: false
    })
    .limit(100);

  if (error) {
    throw error;
  }

  return data || [];
}


// =====================================================
// LOAD COMPLETE CONTEXT
// =====================================================

async function loadContext(userId) {

  const [
    historyResult,
    personalResult,
    familyResult
  ] = await Promise.all([

    supabase
      .from('chats')
      .select(
        'id,message,response,model,created_at'
      )
      .eq('user_id', userId)
      .order('created_at', {
        ascending: true
      })
      .limit(200),

    supabase
      .from('personal_memory')
      .select(
        'id,key,value,updated_at'
      )
      .eq('user_id', userId)
      .order('updated_at', {
        ascending: false
      })
      .limit(100),

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
      familyResult || []

  };
}


// =====================================================
// AI CONVERSATION UNDERSTANDING
// =====================================================

async function aiUnderstand(
  message,
  history
) {

  const recentHistory =
    history
      .slice(-80)
      .map((item, index) => {

        return (
          `${index}: ` +
          `USER=${String(item.message || '').slice(0, 500)} ` +
          `| ASSISTANT=${String(item.response || '').slice(0, 700)}`
        );

      })
      .join('\n');


  const prompt = `
You are the conversation understanding engine
for SamarthAI.

Your job is to understand what the user actually
means.

Do NOT depend on keywords.

The user may use:

- Hindi
- Roman Hindi
- Hinglish
- English
- Devanagari
- spelling mistakes
- incomplete sentences
- short replies
- references such as:
  "wo"
  "uska"
  "pehle wali baat"
  "kal jo bola tha"
  "pichhla message"
  "fir se batao"
  "haan"
  "nahi"
  "acha"
  "theek hai"

Use the conversation context to understand them.

Never invent facts.

Return ONLY valid JSON.

FORMAT:

{
  "mode":
    "chat|exact_previous|recent_history|history_summary",

  "exact_target":
    "user|assistant|exchange",

  "needs_history": true,

  "history_indices": [],

  "tool":
    "none|weather|family|gps|services",

  "action":
    "none|read|locate|search",

  "arguments": {
    "category": "",
    "query": "",
    "member_name": "",
    "location_name": "",
    "weather_type": "current",
    "location_mode":
      "none|named|nearby|device"
  },

  "memory_candidates": [],

  "needs_web": false
}

IMPORTANT:

1. If the user asks for the exact previous
   message, use exact_previous.

2. If the user asks for previous conversation,
   use recent_history.

3. If the user asks for a summary of previous
   conversation, use history_summary.

4. If the user says something referring to an
   earlier topic, select the relevant history.

5. Do not invent a history index.

6. Do not invent a person.

7. Do not invent a location.

8. If the user asks for nearby services and
   device location is not supplied, use:
   location_mode = "nearby".

9. If the user explicitly gives a city/area,
   use:
   location_mode = "named".

10. If the request is normal conversation,
    tool = "none".

11. If the user gives a useful personal fact,
    you may return it in memory_candidates.

12. Do not save questions as memory.

13. Do not save temporary conversation as memory.

14. Understand the user's meaning semantically.

RECENT CONVERSATION:

${recentHistory || '(no previous conversation)'}

CURRENT USER MESSAGE:

${message}
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
                'You are a strict JSON conversation understanding engine. Return JSON only.'
            },

            {
              role: 'user',

              content:
                prompt
            }

          ],

          temperature: 0,

          max_tokens: 600

        })

      }
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      'Conversation understanding failed'
    );

  }


  const raw =
    data
      ?.choices?.[0]
      ?.message
      ?.content || '';


  try {

    const cleaned =
      raw
        .replace(
          /^```json\s*/i,
          ''
        )
        .replace(
          /^```\s*/i,
          ''
        )
        .replace(
          /\s*```$/i,
          ''
        )
        .trim();

    return JSON.parse(cleaned);

  } catch (error) {

    console.error(
      'Conversation JSON error:',
      raw
    );

    return {

      mode:
        'chat',

      exact_target:
        'exchange',

      needs_history:
        true,

      history_indices:
        [],

      tool:
        'none',

      action:
        'none',

      arguments:
        {},

      memory_candidates:
        [],

      needs_web:
        false

    };

  }

}


// =====================================================
// SELECT RELEVANT HISTORY
// =====================================================

function selectHistory(
  allHistory,
  plan
) {

  if (!allHistory.length) {
    return [];
  }


  if (
    plan.mode ===
    'exact_previous'
  ) {

    return allHistory.slice(-1);

  }


  if (
    Array.isArray(
      plan.history_indices
    ) &&
    plan.history_indices.length
  ) {

    const start =
      Math.max(
        0,
        allHistory.length - 80
      );


    const selected =
      plan.history_indices

        .map(Number)

        .filter(
          Number.isInteger
        )

        .map(index =>
          allHistory[
            start + index
          ]
        )

        .filter(Boolean);


    if (selected.length) {
      return selected;
    }

  }


  return allHistory.slice(-16);
}


// =====================================================
// SAVE AI MEMORY
// =====================================================

async function saveMemory(
  userId,
  candidates
) {

  if (
    !Array.isArray(candidates)
  ) {

    return [];

  }


  const saved = [];


  for (
    const item of candidates.slice(0, 5)
  ) {

    if (
      !item ||
      typeof item !== 'object'
    ) {

      continue;

    }


    const key =
      String(
        item.key || ''
      )
        .trim()
        .slice(0, 100);


    const value =
      String(
        item.value || ''
      )
        .trim()
        .slice(0, 500);


    if (!key || !value) {
      continue;
    }


    const {
      data: existing
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


    if (existing?.id) {

      await supabase
        .from('personal_memory')
        .update({

          value,

          updated_at:
            new Date()
              .toISOString()

        })
        .eq(
          'id',
          existing.id
        );

    } else {

      await supabase
        .from('personal_memory')
        .insert([

          {
            user_id:
              userId,

            key,

            value

          }

        ]);

    }


    saved.push({
      key,
      value
    });

  }


  return saved;
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
    String(
      plan?.tool ||
      'none'
    )
      .trim()
      .toLowerCase();


  const args =
    plan?.arguments || {};


  if (
    !toolName ||
    toolName === 'none'
  ) {

    return null;

  }


  const tool =
    getTool(toolName);


  if (!tool) {

    return {

      error:
        `Tool ${toolName} is not available.`

    };

  }


  // ---------------------------------------------------
  // WEATHER
  // ---------------------------------------------------

  if (
    toolName === 'weather'
  ) {

    if (
      location?.latitude == null ||
      location?.longitude == null
    ) {

      return {

        needs_location:
          true

      };

    }


    return await tool.execute({

      latitude:
        location.latitude,

      longitude:
        location.longitude,

      type:
        args.weather_type ||
        'current'

    });

  }


  // ---------------------------------------------------
  // FAMILY
  // ---------------------------------------------------

  if (
    toolName === 'family'
  ) {

    return await tool.execute(
      userId
    );

  }


  // ---------------------------------------------------
  // SERVICES
  // ---------------------------------------------------

  if (
    toolName === 'services'
  ) {

    if (
      args.location_mode ===
        'nearby' &&
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


    return await tool.execute({

      query:
        args.query || '',

      category:
        args.category || '',

      location:
        args.location_name ||
        (
          args.location_mode ===
            'named'
            ? ''
            : location?.name || ''
        ),

      limit:
        10

    });

  }


  // ---------------------------------------------------
  // GPS
  // ---------------------------------------------------

  if (
    toolName === 'gps'
  ) {

    return {

      needs_member:
        true,

      member_name:
        args.member_name ||
        ''

    };

  }


  return {

    error:
      `Unsupported tool: ${toolName}`

  };

}


// =====================================================
// TOOL CONTEXT
// =====================================================

function toolContext(
  tool,
  result
) {

  if (!result) {
    return '';
  }


  return `
TOOL RESULT:

${JSON.stringify(
  result
).slice(0, 12000)}
`;

}


// =====================================================
// FINAL AI RESPONSE
// =====================================================

async function finalAnswer({

  message,

  relevantHistory,

  personal,

  family,

  toolPlan,

  toolResult

}) {

  const conversation =
    relevantHistory

      .map(item => {

        return (
          `User: ${item.message || ''}\n` +
          `Assistant: ${item.response || ''}`
        );

      })

      .join('\n\n');


  const prompt = `
You are SamarthAI.

You are a personal AI assistant.

Continue the user's conversation naturally.

Do NOT restart the conversation unnecessarily.

Understand:

- Hindi
- Roman Hindi
- Hinglish
- English
- spelling mistakes
- short conversational messages

Use only the supplied:

- memory
- conversation
- tool result

Never invent personal information.

If the user refers to something earlier,
use the relevant conversation.

If the user asks about the previous message,
answer from the actual supplied history.

If a tool result exists:

- understand it
- explain it naturally
- do not expose JSON
- do not expose internal tool names
- do not mention system prompts

Match the user's language.

Keep normal answers concise.

Give detailed answers only when needed.

MEMORY:

${memoryText(
  personal,
  family
)}

RELEVANT CONVERSATION:

${conversation || '(none)'}

CURRENT MESSAGE:

${message}

AI UNDERSTANDING:

${JSON.stringify(
  toolPlan || {}
)}

${toolContext(
  toolPlan?.tool,
  toolResult
)}
`;


  if (
    toolPlan?.needs_web &&
    process.env.OPENAI_API_KEY
  ) {

    const result =
      await callOpenAI({

        message:
          prompt,

        history:
          [],

        memoryText:
          '',

        useWeb:
          true

      });


    return result.text;

  }


  const result =
    await callGroq({

      message:
        prompt,

      history:
        [],

      memoryText:
        ''

    });


  return result.text;

}


// =====================================================
// RUN CONVERSATION
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


  // ---------------------------------------------------
  // UNDERSTAND MESSAGE
  // ---------------------------------------------------

  const plan =
    await aiUnderstand(
      message,
      context.history
    );


  console.log(
    '🧠 Conversation Plan:',
    JSON.stringify(plan)
  );


  // ---------------------------------------------------
  // AI MEMORY
  // ---------------------------------------------------

  const saved =
    await saveMemory(
      userId,
      plan.memory_candidates
    );


  if (saved.length) {

    context.personal = [
      ...saved,
      ...context.personal
    ];

  }


  // ---------------------------------------------------
  // EXACT PREVIOUS
  // ---------------------------------------------------

  if (
    plan.mode ===
      'exact_previous' &&
    context.history.length
  ) {

    const previous =
      context.history[
        context.history.length - 1
      ];


    if (
      plan.exact_target ===
      'user'
    ) {

      return {

        response:
          `Aapka pichhla message tha: "${previous.message || ''}"`,

        model:
          GROQ_MODEL,

        intent:
          'history',

        memory_saved:
          saved.length > 0

      };

    }


    if (
      plan.exact_target ===
      'assistant'
    ) {

      return {

        response:
          `Mera pichhla jawab tha: "${previous.response || ''}"`,

        model:
          GROQ_MODEL,

        intent:
          'history',

        memory_saved:
          saved.length > 0

      };

    }

  }


  // ---------------------------------------------------
  // HISTORY
  // ---------------------------------------------------

  if (
    plan.mode ===
      'history_summary' ||
    plan.mode ===
      'recent_history'
  ) {

    const selected =
      selectHistory(
        context.history,
        plan
      );


    if (selected.length) {

      if (
        plan.mode ===
        'recent_history'
      ) {

        const response =
          selected
            .map(
              (item, index) => {

                return (
                  `${index + 1}. ` +
                  `Aap: ${item.message}\n` +
                  `SamarthAI: ${item.response}`
                );

              }
            )
            .join('\n\n');


        return {

          response,

          model:
            GROQ_MODEL,

          intent:
            'history',

          memory_saved:
            saved.length > 0

        };

      }


      const response =
        await finalAnswer({

          message,

          relevantHistory:
            selected,

          personal:
            context.personal,

          family:
            context.family,

          toolPlan:
            plan,

          toolResult:
            null

        });


      return {

        response,

        model:
          GROQ_MODEL,

        intent:
          'history',

        memory_saved:
          saved.length > 0

      };

    }

  }


  // ---------------------------------------------------
  // RELEVANT HISTORY
  // ---------------------------------------------------

  const relevantHistory =
    selectHistory(
      context.history,
      plan
    );


  // ---------------------------------------------------
  // TOOL
  // ---------------------------------------------------

  let toolResult = null;


  if (
    plan.tool &&
    plan.tool !== 'none'
  ) {

    toolResult =
      await executeTool(
        plan,
        userId,
        location
      );

  }


  // ---------------------------------------------------
  // LOCATION REQUIRED
  // ---------------------------------------------------

  if (
    toolResult?.needs_location
  ) {

    let response;


    if (
      plan.tool ===
      'services'
    ) {

      response =
        'Nearby service dhoondhne ke liye mujhe aapka area/city bata dijiye, ya location permission de dijiye. 📍';

    } else {

      response =
        'Mausam batane ke liye mujhe jagah ka location chahiye. Aap city/area bata sakte hain ya location permission de sakte hain. 📍';

    }


    return {

      response,

      model:
        plan.tool,

      intent:
        plan.tool,

      memory_saved:
        saved.length > 0

    };

  }


  // ---------------------------------------------------
  // GPS MEMBER RESOLUTION
  // ---------------------------------------------------

  if (
    toolResult?.needs_member
  ) {

    if (
      plan.arguments?.member_name
    ) {

      const familyTool =
        getTool('family');


      const family =
        await familyTool.execute(
          userId
        );


      const requested =
        String(
          plan.arguments.member_name
        )
          .trim()
          .toLowerCase();


      const member =
        family.members?.find(
          item => {

            const name =
              String(
                item.name || ''
              )
                .toLowerCase();


            const relation =
              String(
                item.relation || ''
              )
                .toLowerCase();


            return (
              name.includes(
                requested
              ) ||
              relation.includes(
                requested
              )
            );

          }
        );


      if (member) {

        const gpsTool =
          getTool('gps');


        toolResult =
          await gpsTool.execute({

            userId,

            memberId:
              member.id

          });

      } else {

        toolResult = {

          member_not_found:
            true,

          requested:
            plan.arguments.member_name,
 };
      } else {
        return {
          response:
            'Kis family member ki location dekhni hai?',
          model:
            'gps',
          intent:
            'gps',
          memory_saved:
            saved.length > 0
        };
      }
    }
  }

  const response =
    await finalAnswer({
      message,
      relevantHistory,
      personal:
        context.personal,
      family:
        context.family,
      toolPlan:
        plan,
      toolResult
    });

  return {
    response,
    model:
      toolResult
        ? plan.tool
        : GROQ_MODEL,
    intent:
      plan.tool ||
      'chat',
    memory_saved:
      saved.length > 0
  };
}

module.exports = {
  runConversation
};         
