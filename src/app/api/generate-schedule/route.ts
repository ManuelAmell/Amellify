import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface AIRequestPayload {
  images?: string[] // Base64 data URLs
  text?: string
  model?: string
}

const SYSTEM_PROMPT = `Actúa como un extractor especializado de horarios universitarios en formato JSON.
Analiza la imagen o texto suministrado y genera un arreglo JSON con las materias y sus horarios correspondientes.

REGLAS OBLIGATORIAS:
- Devuelve ÚNICAMENTE el arreglo JSON válido, sin markdown (\`\`\`json), sin explicaciones.
- code: Código de la materia (máx 8 caracteres, mayúsculas, sin espacios, ej: "CALCVEC", "FISICA1").
- name: Nombre completo de la materia.
- professor: Nombre del docente si está disponible, o string vacío.
- email: Email si está disponible, o string vacío.
- faculty: Facultad o carrera si se menciona, o string vacío.
- semester: Semestre actual (ej: "2026-1"), o string vacío.
- credits: Entero entre 1 y 6 (default 3 si no se especifica).
- status: "active".
- color: Uno de: "blue", "red", "green", "orange", "purple", "teal".
- schedules: Arreglo de bloques horarios con:
  - day: Exactamente uno de: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo".
  - start_time: Formato 24h "HH:MM" (ej: "07:00", "14:20").
  - end_time: Formato 24h "HH:MM" (ej: "08:40", "16:00").
  - room: Salón o aula (ej: "A-301", "Lab 2"), o string vacío.

FORMATO EXACTO:
[
  {
    "code": "CALCVEC",
    "name": "Cálculo Vectorial",
    "professor": "Gabriel Chanchi",
    "email": "",
    "faculty": "Ingeniería de Sistemas",
    "semester": "2026-1",
    "credits": 3,
    "status": "active",
    "color": "blue",
    "schedules": [
      { "day": "Lunes", "start_time": "08:40", "end_time": "10:20", "room": "A-304" }
    ]
  }
]`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body: AIRequestPayload = await request.json()
    const { images = [], text = '', model = 'gemini-2.0-flash' } = body

    if (images.length === 0 && !text.trim()) {
      return NextResponse.json(
        { error: 'Debes proporcionar una imagen o texto del horario' },
        { status: 400 }
      )
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    const openRouterKey = process.env.OPENROUTER_API_KEY

    let rawResponse = ''

    // 1. Try Gemini Direct if key is available
    if (geminiKey) {
      try {
        const parts: any[] = [{ text: SYSTEM_PROMPT }]

        if (text) {
          parts.push({ text: `Texto del horario:\n${text}` })
        }

        for (const img of images) {
          const match = img.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/)
          if (match && match[1] && match[2]) {
            parts.push({
              inline_data: {
                mime_type: match[1],
                data: match[2],
              },
            })
          }
        }

        const modelName = model.includes('/') ? 'gemini-2.0-flash' : model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
              response_mime_type: 'application/json',
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }
      } catch (err) {
        console.warn('Gemini direct failed, trying fallback...', err)
      }
    }

    // 2. Try OpenRouter Fallback
    if (!rawResponse && openRouterKey) {
      try {
        const contentArray: any[] = [{ type: 'text', text: SYSTEM_PROMPT }]
        if (text) {
          contentArray.push({ type: 'text', text: `Texto del horario:\n${text}` })
        }

        for (const img of images) {
          contentArray.push({
            type: 'image_url',
            image_url: { url: img },
          })
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://amellify.vercel.app',
            'X-Title': 'Amellify',
          },
          body: JSON.stringify({
            model: model.includes('/') ? model : 'google/gemini-2.0-flash-001',
            messages: [{ role: 'user', content: contentArray }],
            temperature: 0.1,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          rawResponse = data.choices?.[0]?.message?.content || ''
        }
      } catch (err) {
        console.error('OpenRouter fallback failed:', err)
      }
    }

    if (!rawResponse) {
      return NextResponse.json(
        {
          error:
            'No se pudo conectar con el servicio de IA. Verifica que GEMINI_API_KEY u OPENROUTER_API_KEY estén configuradas en las variables de entorno.',
        },
        { status: 502 }
      )
    }

    // Clean markdown code blocks if any
    let cleaned = rawResponse.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const jsonStart = cleaned.indexOf('[')
    const jsonEnd = cleaned.lastIndexOf(']')
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
    }

    const parsedCourses = JSON.parse(cleaned)

    if (!Array.isArray(parsedCourses)) {
      throw new Error('La IA no devolvió un arreglo de materias válido')
    }

    return NextResponse.json({ courses: parsedCourses })
  } catch (error: any) {
    console.error('Error generating schedule:', error)
    return NextResponse.json(
      { error: error.message || 'Error al procesar el horario con IA' },
      { status: 500 }
    )
  }
}
