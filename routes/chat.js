const express = require('express');
const jwt = require('jsonwebtoken');
const {
  createClient
} = require('@supabase/supabase-js');

const {
  runConversation
} = require(
  '../services/conversationEngine'
);

const router =
  express.Router();


const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );


const JWT_SECRET =
  process.env.JWT_SECRET;


if (!JWT_SECRET) {

  throw new Error(
    'JWT_SECRET environment variable is required'
  );

}


// =====================================================
// AUTH
// =====================================================

function getUserId(req) {

  const token =
    req.headers
      .authorization
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


    return (
      decoded?.id ||
      null
    );

  } catch (error) {

    console.error(
      'JWT error:',
      error.message
    );


    return null;

  }

}


// =====================================================
// IMAGE ANALYSIS
// =====================================================

async function analyzeImage(
  imageBase64,
  message = ''
) {

  if (
    !process.env.GEMINI_API_KEY
  ) {

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

      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,

      {

        method:
          'POST',

        headers: {

          'Content-Type':
            'application/json'

        },

        body:
          JSON.stringify({

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


// =====================================================
// SAVE CHAT
// =====================================================

async function saveChat(
  userId,
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


  return (
    data?.id ||
    null
  );

}


// =====================================================
// LOAD CHAT HISTORY
// =====================================================

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
            ascending:
              true
          }
        )

        .limit(200);


      if (error) {
        throw error;
      }


      return res.json({

        success:
          true,

        chats:
          data || []

      });

    } catch (error) {

      console.error(
        'Chat history error:',
        error
      );


      return res
        .status(500)
        .json({

          error:
            'Chat history load failed'

        });

    }

  }
);


// =====================================================
// MAIN CHAT
// =====================================================

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

      location = null

    } =
      req.body || {};


    if (
      !String(message).trim() &&
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

      // =================================================
      // IMAGE CHAT
      // =================================================

      if (image) {

        const response =
          await analyzeImage(
            image,
            message
          );


        const chatId =
          await saveChat(

            userId,

            message ||
              '[Image]',

            response,

            'gemini-vision'

          );


        return res.json({

          response,

          chat_id:
            chatId,

          provider:
            'gemini',

          model:
            'gemini-1.5-flash',

          intent:
            'image'

        });

      }


      // =================================================
      // AI CONVERSATION ENGINE
      // =================================================

      const cleanMessage =
        String(
          message
        ).trim();


      const result =
        await runConversation({

          userId,

          message:
            cleanMessage,

          location

        });


      // =================================================
      // SAVE RESPONSE
      // =================================================

      const chatId =
        await saveChat(

          userId,

          cleanMessage,

          result.response,

          result.model

        );


      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        response:
          result.response,

        chat_id:
          chatId,

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


      return res
        .status(500)
        .json({

          error:
            error.message ||
            'Internal server error'

        });

    }

  }
);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  router;
