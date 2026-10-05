const express = require('express');
const jwt = require('jsonwebtoken');
const {
  createClient
} = require('@supabase/supabase-js');

const {
  runConversation
} = require('../services/conversationEngine');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required'
  );
}


/* =====================================================
   BASIC HELPERS
===================================================== */

function normalize(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ''));
}


/* =====================================================
   AUTH
===================================================== */

function getUserId(req) {

  const token =
    req.headers.authorization
      ?.split(' ')[1];

  if (!token) {
    return null;
  }

  try {

    const decoded =
      jwt.verify(
        token,
        JWT_SECRET
      );

    return decoded?.id || null;

  } catch (error) {

    console.error(
      'JWT error:',
      error.message
    );

    return null;
  }
}


/* =====================================================
   IMAGE ANALYSIS
===================================================== */

async function analyzeImage(
  imageBase64,
  message = ''
) {

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      'GEMINI_API_KEY is not configured'
    );
  }

  const base64Data =
    imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

  const mimeType =
    imageBase64.match(
      /^data:(.*?);base64,/
    )?.[1] ||
    'image/png';

  const response =
    await fetch(

 `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({

          contents: [

            {
              parts: [

                {
                  text:
                    message ||
                    'Is image ko dhyan se samjho aur Hindi/Hinglish me accurate jawab do.'
                },

                {
                  inline_data: {
                    mime_type:
                      mimeType,

                    data:
                      base64Data
                  }
                }

              ]
            }

          ]
        })
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data.error
  ) {

    throw new Error(
      data?.error?.message ||
      'Image analysis failed'
    );
  }

  return (
    data
      ?.candidates?.[0]
      ?.content?.parts?.[0]
      ?.text ||
    'Image ko samajh nahi paaya.'
  );
}


/* =====================================================
   CONVERSATION HELPERS
===================================================== */

/*
 * Create a new conversation.
 *
 * Title is initially generated from the user's first
 * message. Later the AI/title system can improve it.
 */

async function createConversation(
  userId,
  title = 'New Chat'
) {

  const cleanTitle =
    normalize(title)
      .slice(0, 80) ||
    'New Chat';

  const {
    data,
    error
  } = await supabase

    .from('conversations')

    .insert([

      {
        user_id:
          userId,

        title:
          cleanTitle
      }

    ])

    .select(
      'id,user_id,title,created_at,updated_at'
    )

    .single();

  if (error) {
    console.error(
      'Conversation create error:',
      error
    );

    throw error;
  }

  return data;
}


/*
 * Verify that a conversation belongs to the
 * authenticated user.
 */

async function getOwnedConversation(
  userId,
  conversationId
) {

  if (!isValidUUID(conversationId)) {
    return null;
  }

  const {
    data,
    error
  } = await supabase

    .from('conversations')

    .select(
      'id,user_id,title,created_at,updated_at'
    )

    .eq(
      'id',
      conversationId
    )

    .eq(
      'user_id',
      userId
    )

    .maybeSingle();

  if (error) {

    console.error(
      'Conversation lookup error:',
      error
    );

    throw error;
  }

  return data || null;
}


/*
 * If old frontend sends a message without
 * conversation_id, continue using the latest
 * conversation instead of breaking compatibility.
 */

async function resolveConversation(
  userId,
  conversationId,
  firstMessage = ''
) {

  if (conversationId) {

    const existing =
      await getOwnedConversation(
        userId,
        conversationId
      );

    if (!existing) {
      const error =
        new Error(
          'Conversation not found'
        );

      error.status = 404;

      throw error;
    }

    return existing;
  }


  /*
   * Backward compatibility:
   * use the user's latest conversation.
   */

  const {
    data,
    error
  } = await supabase

    .from('conversations')

    .select(
      'id,user_id,title,created_at,updated_at'
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

    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return data;
  }


  /*
   * First conversation for this user.
   */

  return createConversation(
    userId,
    firstMessage || 'New Chat'
  );
}


/*
 * Update conversation activity.
 */

async function touchConversation(
  userId,
  conversationId
) {

  const {
    error
  } = await supabase

    .from('conversations')

    .update({
      updated_at:
        new Date().toISOString()
    })

    .eq(
      'id',
      conversationId
    )

    .eq(
      'user_id',
      userId
    );

  if (error) {

    console.error(
      'Conversation update error:',
      error
    );
  }
}


/*
 * Save one chat turn inside a conversation.
 */

async function saveChat(
  userId,
  conversationId,
  message,
  response,
  model
) {

  const {
    data,
    error
  } = await supabase

    .from('chats')

    .insert([

      {
        user_id:
          userId,

        conversation_id:
          conversationId,

        message,

        response,

        model
      }

    ])

    .select()

    .single();

  if (error) {

    console.error(
      'Chat save error:',
      error
    );

    return null;
  }

  await touchConversation(
    userId,
    conversationId
  );

  return data?.id || null;
}


/* =====================================================
   CREATE NEW CHAT
===================================================== */

router.post(
  '/conversations',
  async (req, res) => {

    const userId =
      getUserId(req);

    if (!userId) {

      return res
        .status(401)
        .json({
          error:
            'Authentication required'
        });
    }

    try {

      const title =
        normalize(
          req.body?.title ||
          'New Chat'
        );

      const conversation =
        await createConversation(
          userId,
          title
        );

      return res.json({

        success: true,

        conversation

      });

    } catch (error) {

      console.error(
        'New conversation error:',
        error
      );

      return res
        .status(500)
        .json({

          error:
            error.message ||
            'Conversation creation failed'

        });
    }
  }
);


/* =====================================================
   CONVERSATION LIST
===================================================== */

router.get(
  '/history',
  async (req, res) => {

    const userId =
      getUserId(req);

    if (!userId) {

      return res
        .status(401)
        .json({

          error:
            'Authentication required'

        });
    }

    try {

      const {
        data,
        error
      } = await supabase

        .from('conversations')

        .select(
          'id,title,created_at,updated_at'
        )

        .eq(
          'user_id',
          userId
        )

        .order(
          'updated_at',
          {
            ascending:
              false
          }
        )

        .limit(100);

      if (error) {
        throw error;
      }

      return res.json({

        success: true,

        conversations:
          data || [],

        /*
         * Kept for backward compatibility.
         * New frontend will use conversations.
         */
        chats: []

      });

    } catch (error) {

      console.error(
        'Conversation history error:',
        error
      );

      return res
        .status(500)
        .json({

          error:
            'Conversation history load failed'

        });
    }
  }
);


/* =====================================================
   LOAD ONE CONVERSATION
===================================================== */

router.get(
  '/history/:conversationId',
  async (req, res) => {

    const userId =
      getUserId(req);

    if (!userId) {

      return res
        .status(401)
        .json({

          error:
            'Authentication required'

        });
    }

    const conversationId =
      req.params.conversationId;

    try {

      const conversation =
        await getOwnedConversation(
          userId,
          conversationId
        );

      if (!conversation) {

        return res
          .status(404)
          .json({

            error:
              'Conversation not found'

          });
      }


      const {
        data,
        error
      } = await supabase

        .from('chats')

        .select(
          'id,conversation_id,message,response,model,created_at'
        )

        .eq(
          'user_id',
          userId
        )

        .eq(
          'conversation_id',
          conversationId
        )

        .order(
          'created_at',
          {
            ascending:
              true
          }
        )

        .limit(500);

      if (error) {
        throw error;
      }

      return res.json({

        success: true,

        conversation,

        chats:
          data || []

      });

    } catch (error) {

      console.error(
        'Conversation load error:',
        error
      );

      return res
        .status(500)
        .json({

          error:
            'Conversation load failed'

        });
    }
  }
);


/* =====================================================
   DELETE ONE CONVERSATION
===================================================== */

router.delete(
  '/history/:conversationId',
  async (req, res) => {

    const userId =
      getUserId(req);

    if (!userId) {

      return res
        .status(401)
        .json({

          error:
            'Authentication required'

        });
    }

    const conversationId =
      req.params.conversationId;

    try {

      const conversation =
        await getOwnedConversation(
          userId,
          conversationId
        );

      if (!conversation) {

        return res
          .status(404)
          .json({

            error:
              'Conversation not found'

          });
      }


      const {
        error
      } = await supabase

        .from('conversations')

        .delete()

        .eq(
          'id',
          conversationId
        )

        .eq(
          'user_id',
          userId
        );

      if (error) {
        throw error;
      }

      return res.json({

        success: true,

        conversation_id:
          conversationId

      });

    } catch (error) {

      console.error(
        'Conversation delete error:',
        error
      );

      return res
        .status(500)
        .json({

          error:
            'Conversation delete failed'

        });
    }
  }
);


/* =====================================================
   MAIN CHAT
===================================================== */

router.post(
  '/',
  async (req, res) => {

    const userId =
      getUserId(req);

    if (!userId) {

      return res
        .status(401)
        .json({

          error:
            'Authentication required'

        });
    }


 const {
    message = '',
    image = null,
    location = null,
    conversation_id = null,
    metadata = {}
} =
    req.body || {};

const responseLanguage =
    typeof metadata.language === 'string' &&
    metadata.language.trim()
        ? metadata.language.trim()
        : 'hi-IN';




    const cleanMessage =
      normalize(message);


    if (
      !cleanMessage &&
      !image
    ) {

      return res
        .status(400)
        .json({

          error:
            'Message or image required'

        });
    }


    try {

      /*
       * Resolve conversation before AI processing.
       */

      const conversation =
        await resolveConversation(

          userId,

          conversation_id,

          cleanMessage ||
            'Image Chat'

        );


      const conversationId =
        conversation.id;


      /* ===============================================
         IMAGE CHAT
      =============================================== */

      if (image) {

        const response =
          await analyzeImage(

            image,

            
            cleanMessage
          );


        const chatId =
          await saveChat(

            userId,

            conversationId,

            cleanMessage ||
              '[Image]',

            response,

            'gemini-vision'

          );


        return res.json({

          success: true,

          response,

          chat_id:
            chatId,

          conversation_id:
            conversationId,

          conversation,

          provider:
            'gemini',

          model:
       'gemini-3.8-flash',    

          intent:
            'image'

        });

      }


      /* ===============================================
         AI CONVERSATION ENGINE
      =============================================== */

const result =
    await runConversation({

        userId,

        message:
            cleanMessage,

        location,

        conversationId,

        responseLanguage

    });


      /* ===============================================
         SAVE RESPONSE
      =============================================== */

      const chatId =
        await saveChat(

          userId,

          conversationId,

          cleanMessage,

          result.response,

          result.model

        );


      /* ===============================================
         RESPONSE
      =============================================== */

      return res.json({

        success: true,

        response:
          result.response,

        chat_id:
          chatId,

        conversation_id:
          conversationId,

        conversation,

        provider:
          'samarthai-conversation-engine',

        model:
          result.model,

        intent:
          result.intent,

        web_used:
          Boolean(
            result.web_used
          ),

        memory_saved:
          Boolean(
            result.memory_saved
          )

      });

    } catch (error) {

      console.error(
        '❌ Chat error:',
        error
      );


      const status =
        Number(error?.status) || 500;


      return res
        .status(status)
        .json({

          error:
            error.message ||
            'Internal server error'

        });

    }

  }
);


/* =====================================================
   EXPORT
===================================================== */

module.exports =
  router;
