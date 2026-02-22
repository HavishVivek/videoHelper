import Groq from 'groq-sdk'

let client = null
let usingLMStudio = false

function getClient() {
  if (!client) {
    // Check if LM Studio is configured (preferred for local/free usage)
    const lmStudioUrl = import.meta.env.VITE_LM_STUDIO_URL || 'http://localhost:1234/v1'
    const useLMStudio = import.meta.env.VITE_USE_LM_STUDIO === 'true'

    if (useLMStudio) {
      // Use LM Studio's OpenAI-compatible endpoint
      client = new Groq({
        apiKey: 'lm-studio', // LM Studio doesn't require a real API key
        baseURL: lmStudioUrl,
        dangerouslyAllowBrowser: true
      })
      usingLMStudio = true
      console.log('🤖 Using LM Studio at:', lmStudioUrl)
    } else {
      // Fall back to Groq cloud API
      client = new Groq({
        apiKey: import.meta.env.VITE_GROQ_API_KEY,
        dangerouslyAllowBrowser: true
      })
      usingLMStudio = false
      console.log('🤖 Using Groq cloud API')
    }
  }
  return client
}

// Get the appropriate model name based on provider
function getModelName() {
  if (usingLMStudio) {
    // LM Studio uses whatever model you have loaded
    // It typically expects 'local-model' or you can specify your model name
    return import.meta.env.VITE_LM_STUDIO_MODEL || 'local-model'
  }
  return 'llama-3.3-70b-versatile'
}

const SYSTEM_PROMPTS = {
  channelAnalysis: `You are an expert YouTube content analyst. Analyze the provided channel data and video metadata to identify patterns in successful content. Focus on:
- Hook styles (questions, stories, bold statements, problem/solution)
- Pacing patterns and video structure
- Topic preferences and audience engagement
- What makes their top videos outperform others
Provide actionable, specific insights.`,

  scriptGeneration: `You are an expert YouTube scriptwriter. Based on the channel analysis and topic provided, generate engaging video scripts. Each script should follow proven YouTube patterns:
- Strong hook in the first 10 seconds
- Clear value proposition
- Engagement loops to maintain retention
- Strategic call-to-action placement
Format scripts with clear section markers: [HOOK], [INTRO], [BODY], [CTA], [OUTRO].`,

  introVariations: `You are an expert YouTube scriptwriter specializing in video intros. Generate distinct intro variations for the given topic, each using a different hook strategy. For each variation provide:
1. The hook type (Question, Story/Anecdote, Bold Statement, Problem/Solution)
2. The full intro text (first 30-60 seconds of script)
3. A hook strength score (1-10)
4. Predicted retention percentage for the intro
5. Brief explanation of why this hook works

Respond in valid JSON format as an array of objects with keys: hookType, introText, hookStrength, predictedRetention, explanation.`,

  editingFeedback: `You are a YouTube content editor providing real-time feedback on video scripts. Analyze the script section and provide:
- Pacing assessment (too fast, good, too slow)
- Hook effectiveness (for intro sections)
- Engagement prediction at this point
- Specific improvement suggestions
Keep feedback concise and actionable. Respond in valid JSON with keys: pacing, hookEffectiveness, engagementScore, suggestions (array of strings), retentionPrediction (number 0-100).`,

  performancePrediction: `You are a YouTube analytics expert. Based on the channel's historical performance data and the provided script, predict:
- Overall retention percentage
- Engagement score (likes/views ratio prediction)
- Key drop-off points in the script
- Which past video this most resembles in structure
- Specific improvement suggestions
Respond in valid JSON with keys: retentionPercent, engagementScore, dropOffPoints (array of {timestamp, reason}), similarVideo (string), suggestions (array of strings), retentionCurve (array of numbers 0-100 representing retention at each 10% interval).`,

  thumbnailGeneration: `You are an expert YouTube thumbnail designer. Create 3 distinct thumbnail concepts for the provided video script. Each concept should be designed for high Click-Through Rate (CTR).
For each concept provide:
1. Visual Description: What exactly is in the image (subject, background, expression, props).
2. Text Overlay: Short, punchy text (max 3-5 words) that complements the title but doesn't repeat it.
3. Color Theory: Main colors and mood.
4. Why it Works: Psychological reason this will get clicks.
Respond in valid JSON format as an array of objects with keys: conceptName, description, textOverlay, colorMood, psychology.`,

  metadataOptimizer: `You are a YouTube SEO expert. Generate high-performing metadata for the provided video script.
1. Generate 5 viral-style titles (mix of curiosity, benefit-driven, and urgency).
2. Write a compelling, keyword-rich video description (first 2 lines are crucial).
3. Generate 15-20 relevant tags/keywords used by top creators in this niche.
Respond in valid JSON with keys: titles (array of strings), description (string), tags (array of strings), category (string).`,

  thumbnailTitles: `You are a YouTube thumbnail text expert. Create 3 distinct, punchy text overlays for video thumbnails based on the provided topic and script.

Each text should:
- Be 3-5 words maximum (short and impactful)
- Create curiosity or urgency
- Be readable at small sizes
- Complement the video title (not repeat it)
- Use power words and emotional triggers

Respond in valid JSON format as an array of 3 strings (the text overlays for each thumbnail).

Examples of good thumbnail text:
- "THIS CHANGED EVERYTHING"
- "You're Doing It WRONG"
- "The SECRET Method"
- "Watch Before DELETED"
- "2024 METHOD"

Keep it BOLD, SHORT, and CLICKABLE.`
}

export async function analyzeChannel(channelData, topVideos) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.channelAnalysis },
      {
        role: 'user',
        content: `Channel: ${channelData.title} (${channelData.subscriberCount} subscribers)

Top performing videos:
${topVideos.map((v, i) => `${i + 1}. "${v.title}" — ${v.viewCount} views, ${v.likeCount} likes, ${v.commentCount} comments`).join('\n')}

Analyze this channel's content patterns and what makes their top videos successful.`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  })
  return response.choices[0].message.content
}

export async function generateIntroVariations(topic, channelAnalysis, notes = '') {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.introVariations },
      {
        role: 'user',
        content: `Topic: ${topic}
${notes ? `Additional context: ${notes}` : ''}
${channelAnalysis ? `Channel analysis: ${channelAnalysis}` : ''}

Generate 4 distinct intro variations using different hook strategies.`
      }
    ],
    temperature: 0.8,
    max_tokens: 3000,
    response_format: { type: 'json_object' }
  })
  try {
    const parsed = JSON.parse(response.choices[0].message.content)
    // The LLM may wrap the array in any key — find the first array in the response
    if (Array.isArray(parsed)) return parsed
    const arrayValue = Object.values(parsed).find(v => Array.isArray(v))
    if (arrayValue) return arrayValue
    return []
  } catch (e) {
    console.error('Failed to parse intro variations:', e, response.choices[0].message.content)
    return []
  }
}

export async function generateFullScript(topic, selectedIntro, channelAnalysis) {
  const groq = getClient()
  const chunks = []

  const stream = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.scriptGeneration },
      {
        role: 'user',
        content: `Topic: ${topic}
Selected intro: ${selectedIntro}
${channelAnalysis ? `Channel patterns: ${channelAnalysis}` : ''}

Generate a complete YouTube video script starting with this intro. Include section markers [HOOK], [INTRO], [BODY], [CTA], [OUTRO].`
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
    stream: true
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    chunks.push(content)
  }

  return chunks.join('')
}

export async function* streamFullScript(topic, selectedIntro, channelAnalysis) {
  const groq = getClient()
  const stream = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.scriptGeneration },
      {
        role: 'user',
        content: `Topic: ${topic}
Selected intro: ${selectedIntro}
${channelAnalysis ? `Channel patterns: ${channelAnalysis}` : ''}

Generate a complete YouTube video script starting with this intro. Include section markers [HOOK], [INTRO], [BODY], [CTA], [OUTRO].`
      }
    ],
    temperature: 0.7,
    max_tokens: 4000,
    stream: true
  })

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || ''
    if (content) yield content
  }
}

export async function generateScriptVariations(topic, selectedIntro, channelAnalysis) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { 
        role: 'system', 
        content: `You are an expert YouTube scriptwriter. Generate 3 distinct script variations for the same topic and intro, each with a different style and approach. Each variation should be complete and ready to use.

Variation styles:
1. Educational/Tutorial - Focus on teaching, step-by-step, informative
2. Entertaining/Engaging - Focus on energy, personality, entertainment value
3. Storytelling/Narrative - Focus on story arc, emotional connection, journey

Respond in valid JSON format as an array of objects with keys: style, title, content (full script with [HOOK], [INTRO], [BODY], [CTA], [OUTRO] markers), estimatedLength (in minutes), tone.`
      },
      {
        role: 'user',
        content: `Topic: ${topic}
Selected intro: ${selectedIntro}
${channelAnalysis ? `Channel patterns: ${channelAnalysis}` : ''}

Generate 3 complete script variations with different styles.
CRITICAL INSTRUCTION: You MUST start each script variation with the EXACT "Selected intro" text provided above. Do not change a single word of the intro.
Then continue the script with [BODY], [CTA], and [OUTRO] sections.`
      }
    ],
    temperature: 0.8,
    max_tokens: 6000,
    response_format: { type: 'json_object' }
  })
  
  try {
    const parsed = JSON.parse(response.choices[0].message.content)
    // The LLM may wrap the array in any key — find the first array in the response
    if (Array.isArray(parsed)) return parsed
    const arrayValue = Object.values(parsed).find(v => Array.isArray(v))
    if (arrayValue) return arrayValue
    return []
  } catch (e) {
    console.error('Failed to parse script variations:', e, response.choices[0].message.content)
    return []
  }
}

export async function getEditingFeedback(scriptContent, sectionType) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.editingFeedback },
      {
        role: 'user',
        content: `Section type: ${sectionType}
Script content:
${scriptContent}

Provide editing feedback for this script section.`
      }
    ],
    temperature: 0.5,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  })
  try {
    return JSON.parse(response.choices[0].message.content)
  } catch {
    return { pacing: 'unknown', hookEffectiveness: 0, engagementScore: 0, suggestions: [], retentionPrediction: 50 }
  }
}

export async function predictPerformance(scriptContent, channelData, topVideos) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.performancePrediction },
      {
        role: 'user',
        content: `Script:
${scriptContent}

Channel: ${channelData.title} (${channelData.subscriberCount} subs, avg ${Math.round(channelData.viewCount / channelData.videoCount)} views/video)

Top videos for comparison:
${topVideos.slice(0, 5).map((v, i) => `${i + 1}. "${v.title}" — ${v.viewCount} views`).join('\n')}

Predict performance for this script.`
      }
    ],
    temperature: 0.6,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  })
  try {
    return JSON.parse(response.choices[0].message.content)
  } catch {
    return {
      retentionPercent: 50,
      engagementScore: 5,
      dropOffPoints: [],
      similarVideo: 'Unknown',
      suggestions: ['Unable to parse prediction'],
      retentionCurve: [100, 80, 70, 60, 55, 50, 48, 45, 43, 40]
    }
  }
}

export async function generateThumbnailConcepts(scriptContent, topic) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.thumbnailGeneration },
      {
        role: 'user',
        content: `Topic: ${topic}
Script:
${scriptContent.substring(0, 3000)}... (truncated)

Generate 3 high-CTR thumbnail concepts.`
      }
    ],
    temperature: 0.8,
    max_tokens: 1500,
    response_format: { type: 'json_object' }
  })
  try {
    const parsed = JSON.parse(response.choices[0].message.content)
    if (Array.isArray(parsed)) return parsed
    const array = Object.values(parsed).find(v => Array.isArray(v))
    return array || []
  } catch (e) {
    console.error('Thumbnail generation error', e)
    return []
  }
}

export async function generateMetadata(scriptContent, topic) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.metadataOptimizer },
      {
        role: 'user',
        content: `Topic: ${topic}
Script:
${scriptContent.substring(0, 3000)}... (truncated)

Generate optimized metadata (titles, description, tags).`
      }
    ],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: 'json_object' }
  })
  try {
    return JSON.parse(response.choices[0].message.content)
  } catch (e) {
    console.error('Metadata generation error', e)
    return null
  }
}

export async function generateThumbnailTitles(scriptContent, topic) {
  const groq = getClient()
  const response = await groq.chat.completions.create({
    model: getModelName(),
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS.thumbnailTitles },
      {
        role: 'user',
        content: `Topic: ${topic}
Script:
${scriptContent.substring(0, 2000)}... (truncated)

Generate 3 punchy thumbnail text overlays (3-5 words each).`
      }
    ],
    temperature: 0.9,
    max_tokens: 500,
    response_format: { type: 'json_object' }
  })
  try {
    const parsed = JSON.parse(response.choices[0].message.content)
    // The LLM may wrap the array in any key — find the first array in the response
    if (Array.isArray(parsed)) return parsed
    const arrayValue = Object.values(parsed).find(v => Array.isArray(v))
    if (arrayValue && arrayValue.length === 3) return arrayValue
    // Fallback: generate default titles
    return [
      `${topic.substring(0, 20).toUpperCase()}`,
      'WATCH THIS NOW',
      'YOU NEED TO SEE THIS'
    ]
  } catch (e) {
    console.error('Thumbnail titles generation error', e)
    return [
      `${topic.substring(0, 20).toUpperCase()}`,
      'WATCH THIS NOW',
      'YOU NEED TO SEE THIS'
    ]
  }
}
