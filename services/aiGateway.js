const GROQ_MODEL = 'openai/gpt-oss-20b';
const OPENAI_MODEL = 'gpt-6-astra';
const CLAUDE_MODEL = 'claude-fable-5-1';

function cleanText(value) {
  return String(value || '').trim();
}

// =====================================================
// AI TOOL PLANNER
// =====================================================

async function planToolCall({
  message,
  history = []
}) {

  if (!process.env.GROQ_API_KEY) {
    return {
      tool: 'none',
      action: 'none',
      arguments: {},
      confidence: 0
    };
  }

  const tools = `
AVAILABLE TOOLS:

1. weather
   Purpose: Current or forecast weather information.
   Actions: read

2. family
   Purpose: Read family members and family information.
   Actions: read

3. gps
   Purpose: Locate a family member.
   Actions: locate

4. services
   Purpose: Search SamarthAI service providers.
   Actions: search

5. none
   Purpose: Normal conversation or a feature that is not currently handled by the tool system.
`;

  const prompt = `
You are the intent and tool planner for SamarthAI.

Understand the user's meaning, not exact keywords.

The user may speak:
- Hindi
- Roman Hindi
- Hinglish
- English
- Devanagari Hindi
- with spelling mistakes
- with short conversational phrases

Do NOT depend on fixed keywords.

Decide whether a tool is required.

${tools}

Return ONLY valid JSON.

Required JSON format:

{
  "tool": "weather|family|gps|services|none",
  "action": "read|locate|search|none",
  "arguments": {
    "category": "",
    "member_name": "",
    "location_name": "",
    "weather_type": "current"
  },
  "confidence": 0
}

Rules:

- "मेरे लिए प्लंबर खोजो"
  means services/search and category should be plumber.

- "मेरे घर का नल खराब है कोई आदमी भेजो"
  means services/search and category should be plumber.

- "मुझे बिजली वाला चाहिए"
  means services/search and category should be electrician.

- "मेरी फैमिली दिखाओ"
  means family/read.

- "सुनील कहाँ है?"
  means gps/locate and member_name should be सुनील.

- "भाई कहाँ है?"
  means gps/locate and member_name should be भाई.

- "आज मौसम कैसा है?"
  means weather/read and weather_type current.

- "कल का मौसम बताओ"
  means weather/read and weather_type daily.

- Normal conversation means none.

Do not execute anything.
Do not invent a member name.
Do not invent a location.
Do not return explanations outside JSON.
`;

  const recentHistory =
    history
      .slice(-8)
      .map(item => {

        const user =
          item.message
            ? `User: ${item.message}`
            : '';

        const assistant =
          item.response
            ? `Assistant: ${item.response}`
            : '';

        return `${user}\n${assistant}`;

      })
      .join('\n\n');

  const response = await fetch(
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
            content: prompt
          },

          {
            role: 'user',
            content:
              `Recent conversation:\n${recentHistory}\n\nCurrent message:\n${message}`
          }

        ],

        temperature: 0,

        max_tokens: 300

      })
    }
  );

  const data =
    await response.json();

  if (!response.ok) {

    console.error(
      'Tool planner error:',
      JSON.stringify(data)
    );

    return {
      tool: 'none',
      action: 'none',
      arguments: {},
      confidence: 0
    };
  }

  const raw =
    data.choices?.[0]?.message?.content || '';

  try {

    const cleaned =
      raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const plan =
      JSON.parse(cleaned);

    return {

      tool:
        typeof plan.tool === 'string'
          ? plan.tool
          : 'none',

      action:
        typeof plan.action === 'string'
          ? plan.action
          : 'none',

      arguments:
        plan.arguments &&
        typeof plan.arguments === 'object'
          ? plan.arguments
          : {},

      confidence:
        Number(plan.confidence) || 0

    };

  } catch (error) {

    console.error(
      'Tool planner JSON error:',
      raw
    );

    return {
      tool: 'none',
      action: 'none',
      arguments: {},
      confidence: 0
    };
  }
}
// =====================================================
// PROVIDER: GROQ
// =====================================================

async function callGroq({
  message,
  history = [],
  memoryText = ''
}) {

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const messages = [
    {
      role: 'system',
      content: `
You are SamarthAI, a personal AI assistant.

Rules:
- Understand Hindi, Roman Hindi and Hinglish.
- Maintain conversation continuity.
- Use supplied memory only when relevant.
- Never invent memories.
- Answer naturally and directly.
- If the user asks for current information, do not pretend your knowledge is live.
- If a tool is required, the application should route the request to the appropriate tool.

MEMORY:
${memoryText}
`
    }
  ];

  for (const item of history) {

    if (item.message) {
      messages.push({
        role: 'user',
        content: item.message
      });
    }

    if (item.response) {
      messages.push({
        role: 'assistant',
        content: item.response
      });
    }

  }

  messages.push({
    role: 'user',
    content: message
  });


  const response = await fetch(
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
        model: GROQ_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 700
      })
    }
  );


  const data = await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      'Groq API request failed'
    );

  }


  return {
    text:
      data.choices?.[0]?.message?.content ||
      'Mujhe iska jawab nahi mil paaya.',

    provider: 'groq',

    model: GROQ_MODEL
  };

}


// =====================================================
// PROVIDER: OPENAI GPT-6 ASTRA
// =====================================================

async function callOpenAI({
  message,
  history = [],
  memoryText = '',
  useWeb = false
}) {

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is not configured'
    );
  }


  const input = [];


  input.push({
    role: 'system',
    content: `
You are SamarthAI.

You are the central intelligent assistant of the SamarthAI application.

Understand:
- Hindi
- Roman Hindi
- Hinglish
- English

Use conversation history and supplied memory naturally.

Do not invent personal information.

When live/current information is requested, use web search when the application enables it.

MEMORY:
${memoryText}
`
  });


  for (const item of history) {

    if (item.message) {

      input.push({
        role: 'user',
        content: item.message
      });

    }

    if (item.response) {

      input.push({
        role: 'assistant',
        content: item.response
      });

    }

  }


  input.push({
    role: 'user',
    content: message
  });


  const body = {

    model: OPENAI_MODEL,

    input,

    max_output_tokens: 1200

  };


  // ---------------------------------------------------
  // WEB SEARCH
  // ---------------------------------------------------

  if (useWeb) {

    body.tools = [
      {
        type: 'web_search'
      }
    ];

  }


  const response = await fetch(
    'https://api.openai.com/v1/responses',
    {

      method: 'POST',

      headers: {

        Authorization:
          `Bearer ${process.env.OPENAI_API_KEY}`,

        'Content-Type':
          'application/json'

      },

      body: JSON.stringify(body)

    }
  );


  const data = await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      'OpenAI API request failed'
    );

  }


  let text = '';


  if (typeof data.output_text === 'string') {

    text =
      data.output_text.trim();

  }


  if (!text && Array.isArray(data.output)) {

    for (const item of data.output) {

      if (
        item.type === 'message' &&
        Array.isArray(item.content)
      ) {

        for (const part of item.content) {

          if (
            part.type === 'output_text' &&
            part.text
          ) {

            text +=
              part.text + '\n';

          }

        }

      }

    }

  }


  return {

    text:
      text.trim() ||
      'Mujhe iska jawab nahi mil paaya.',

    provider: 'openai',

    model: OPENAI_MODEL,

    web_used: useWeb

  };

}


// =====================================================
// PROVIDER: CLAUDE FABLE 5.1
// =====================================================

async function callClaude({
  message,
  history = [],
  memoryText = ''
}) {

  if (!process.env.ANTHROPIC_API_KEY) {

    throw new Error(
      'ANTHROPIC_API_KEY is not configured'
    );

  }


  const messages = [];


  for (const item of history) {

    if (item.message) {

      messages.push({
        role: 'user',
        content: item.message
      });

    }

    if (item.response) {

      messages.push({
        role: 'assistant',
        content: item.response
      });

    }

  }


  messages.push({
    role: 'user',
    content: message
  });


  const response = await fetch(
    'https://api.anthropic.com/v1/messages',
    {

      method: 'POST',

      headers: {

        'x-api-key':
          process.env.ANTHROPIC_API_KEY,

        'anthropic-version':
          '2023-06-01',

        'content-type':
          'application/json'

      },

      body: JSON.stringify({

        model: CLAUDE_MODEL,

        max_tokens: 1200,

        system: `
You are SamarthAI.

Understand Hindi, Roman Hindi, Hinglish and English.

Be precise and practical.

Use the supplied memory only when relevant.

Never invent memory.

MEMORY:
${memoryText}
`,

        messages

      })

    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      'Claude API request failed'
    );

  }


  let text = '';


  if (Array.isArray(data.content)) {

    for (const item of data.content) {

      if (
        item.type === 'text' &&
        item.text
      ) {

        text +=
          item.text + '\n';

      }

    }

  }


  return {

    text:
      text.trim() ||
      'Mujhe iska jawab nahi mil paaya.',

    provider: 'claude',

    model: CLAUDE_MODEL

  };

}


// =====================================================
// INTENT DETECTION
// =====================================================

function detectIntent(message) {

  const text =
    cleanText(message).toLowerCase();


  if (!text) {

    return 'chat';

  }


// ---------------------------------------------------
  // WEATHER
  // ---------------------------------------------------

  if (
    /(weather|mausam|baarish|barish|temperature|temp|garmi|thand|badal|rain)/i
      .test(text)
  ) {

    return 'weather';

  }


  // ---------------------------------------------------
  // WEB
  // ---------------------------------------------------

  if (
    /(latest|today|abhi|current|recent|news|aaj|taaza|live|price|rate|2026)/i
      .test(text)
  ) {

    return 'web';

  }


  // ---------------------------------------------------
  // FAMILY
  // ---------------------------------------------------

  if (
    /(family|parivaar|parivar|mummy|papa|bhai|behen|family member)/i
      .test(text)
  ) {

    return 'family';

  }


  // ---------------------------------------------------
  // GPS
  // ---------------------------------------------------

  if (
    /(location|locate|kahan hai|kahan ho|location batao|gps)/i
      .test(text)
  ) {

    return 'gps';

  }


  // ---------------------------------------------------
  // SOS
  // ---------------------------------------------------

  if (
    /(sos|emergency|madad chahiye|help me|danger)/i
      .test(text)
  ) {

    return 'sos';

  }


  // ---------------------------------------------------
  // SCANNER / IMAGE
  // ---------------------------------------------------

  if (
    /(scan|scanner|document|photo|image|tasveer)/i
      .test(text)
  ) {

    return 'scanner';

  }


  // ---------------------------------------------------
  // SERVICES
  // ---------------------------------------------------

  if (
    /(plumber|electrician|carpenter|service|mistri|repair|mechanic|cleaning)/i
      .test(text)
  ) {

    return 'services';

  }


  // ---------------------------------------------------
  // COMPLEX / CODE
  // ---------------------------------------------------

  if (
    /(code|coding|program|programming|github|debug|developer|api|architecture|server|database|javascript|node|react)/i
      .test(text)
  ) {

    return 'complex';

  }


  return 'chat';

}


// =====================================================
// ROUTER
// =====================================================

async function routeAI({
  message,
  history = [],
  memoryText = ''
}) {

  const intent =
    detectIntent(message);


  // ---------------------------------------------------
  // WEB
  // ---------------------------------------------------

  if (intent === 'web') {

    const result =
      await callOpenAI({

        message,

        history,

        memoryText,

        useWeb: true

      });


    return {

      ...result,

      intent

    };

  }


  // ---------------------------------------------------
  // COMPLEX
  // ---------------------------------------------------

  if (intent === 'complex') {

    if (process.env.OPENAI_API_KEY) {

      const result =
        await callOpenAI({

          message,

          history,

          memoryText,

          useWeb: false

        });


      return {

        ...result,

        intent

      };

    }


    if (process.env.ANTHROPIC_API_KEY) {

      const result =
        await callClaude({

          message,

          history,

          memoryText

        });


      return {

        ...result,

        intent

      };

    }

  }


  // ---------------------------------------------------
  // NORMAL CHAT
  // ---------------------------------------------------

  if (process.env.GROQ_API_KEY) {

    const result =
      await callGroq({

        message,

        history,

        memoryText

      });


    return {

      ...result,

      intent

    };

  }


  // ---------------------------------------------------
  // FALLBACK
  // ---------------------------------------------------

  if (process.env.OPENAI_API_KEY) {

    const result =
      await callOpenAI({

        message,

        history,

        memoryText,

        useWeb: false

      });


    return {

      ...result,

      intent

    };

  }


  if (process.env.ANTHROPIC_API_KEY) {

    const result =
      await callClaude({

        message,

        history,

        memoryText

      });


    return {

      ...result,

      intent

    };

  }


  throw new Error(
    'No AI provider is configured'
  );

}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

  routeAI,

  detectIntent,

  planToolCall,

  callGroq,

  callOpenAI,

  callClaude

};
