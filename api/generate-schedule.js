const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const OPENROUTER_MODELS = [
  'google/gemini-3.6-flash',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4o',
];

function parseDataUrl(url) {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(url || '');
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function isRecoverableError(status, message) {
  const msg = (message || '').toLowerCase();
  if (['rate limit', 'key limit', 'insufficient credits', 'no endpoints', 'overloaded', 'unavailable', 'resource exhausted', 'quota', '429'].some((k) => msg.includes(k))) return true;
  if ([402, 429, 502, 503, 404, 500].includes(status)) return true;
  return false;
}

async function callGemini(apiKey, model, prompt, imgs, origin) {
  const parts = [{ text: prompt }];
  for (const url of imgs) {
    const parsed = parseDataUrl(url);
    if (!parsed) return { ok: false, status: 400, content: '', error: 'Imagen inválida' };
    parts.push({ inline_data: { mime_type: parsed.mimeType, data: parsed.data } });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    }
  );
  const data = await response.json().catch(() => ({}));
  const message = data?.error?.message || `Error de Gemini: ${response.status}`;
  const content = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return { ok: response.ok, status: response.status, content, error: response.ok ? '' : message };
}

async function callOpenRouter(apiKey, model, prompt, imgs, origin) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': origin || 'https://amellify.app',
      'X-Title': 'Amellify Schedule Import',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imgs.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });
  const data = await response.json().catch(() => ({}));
  const message = data?.error?.message || `Error de OpenRouter: ${response.status}`;
  const content = data?.choices?.[0]?.message?.content || '';
  return { ok: response.ok, status: response.status, content, error: response.ok ? '' : message };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!geminiKey && !openRouterKey) {
    return res.status(500).json({ error: 'No hay API keys configuradas (GEMINI_API_KEY u OPENROUTER_API_KEY)' });
  }

  const { image, images, model } = req.body;
  const imgs = Array.isArray(images) && images.length ? images : (image ? [image] : []);
  if (!imgs.length) {
    return res.status(400).json({ error: 'Falta la imagen o el PDF' });
  }
  if (imgs.length > 8) {
    return res.status(400).json({ error: 'Máximo 8 imágenes por petición' });
  }

  const prompt = `Quiero que actúes como un generador de horarios universitarios en formato JSON. Te paso una o más imágenes de mi horario de clases (si son varias, pueden ser páginas de un PDF) y debés devolver SOLO un arreglo JSON válido, sin markdown fences, sin explicaciones, sin texto adicional.

FORMATO EXACTO DE SALIDA:
[
  {
    "code": "CALCVEC",
    "name": "Cálculo Vectorial",
    "professor": "Juan Pérez",
    "email": "",
    "faculty": "Ingeniería de Sistemas",
    "semester": "2025-1",
    "credits": 3,
    "status": "active",
    "color": "blue",
    "schedules": [
      { "day": "Lunes", "start_time": "08:40", "end_time": "10:20", "room": "A-301" }
    ],
    "partials": []
  }
]

REGLAS POR CAMPO:
- code: Obligatorio. Máx 8 caracteres, solo mayúsculas, sin espacios, sin acentos. Inventar sigla si no se sabe. NUNCA vacío.
- name: Obligatorio. Nombre completo exacto.
- professor, email, faculty, semester: Opcional, string vacío si no se sabe.
- credits: Obligatorio. Entero 1-6. Default 3.
- status: Siempre "active".
- color: "blue", "red", "green", "orange", "purple", "teal". Default "blue". Distribuir distintos.
- schedules: Array con UNO o MÁS objetos. Una materia que se ve varios días tiene un objeto por cada día.
  - day: Valor EXACTO: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo". Con mayúscula y tilde. NUNCA en inglés.
  - start_time / end_time: "HH:MM" en 24h, siempre dos dígitos. Ej: "07:00", "08:40", "14:30". Incorrecto: "7:00", "3pm".
  - room: Opcional, string vacío.
- partials: Siempre [].

VALIDACIÓN FINAL:
- Todos los name presentes y no vacíos.
- Todos los code mayúsculas, sin espacios ni acentos, máx 8 chars.
- Todos los day escritos exactamente como en la lista (con mayúscula y tilde).
- Todas las horas en formato "HH:MM" con dos dígitos.
- Días en español, NO en inglés.
- partials siempre [], status siempre "active".
- El JSON debe ser parseable sin errores.

INSTRUCCIÓN: Devolvé SOLAMENTE el arreglo JSON. Sin comillas invertidas, sin explicaciones, sin saludos. Solo [ ... ].`;

  const requestedModel = model || 'google/gemini-3.6-flash';
  const attempts = [];

  if (geminiKey) {
    const geminiAlias = requestedModel.replace(/^google\//, '');
    attempts.push(...[geminiAlias, ...GEMINI_MODELS].filter((m, i, arr) => arr.indexOf(m) === i).map((m) => ({ provider: 'gemini', model: m })));
  }
  if (openRouterKey) {
    attempts.push(...OPENROUTER_MODELS.filter((m) => m !== requestedModel).map((m) => ({ provider: 'openrouter', model: m })));
  }
  if (attempts.length > 6) attempts.length = 6;

  let lastError = null;
  for (const attempt of attempts) {
    let result;
    try {
      if (attempt.provider === 'gemini') {
        result = await callGemini(geminiKey, attempt.model, prompt, imgs, req.headers.origin);
      } else {
        result = await callOpenRouter(openRouterKey, attempt.model, prompt, imgs, req.headers.origin);
      }
    } catch (e) {
      lastError = { status: 500, message: e.message || 'Error desconocido' };
      continue;
    }

    if (!result.ok) {
      if (isRecoverableError(result.status, result.error)) {
        lastError = { status: result.status, message: result.error };
        continue;
      }
      return res.status(result.status).json({ error: result.error });
    }

    const raw = (result.content || '').replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
    let courses;
    try {
      courses = JSON.parse(raw);
    } catch (e) {
      return res.status(422).json({ error: 'La IA devolvió un JSON inválido. Intentá con otro modelo.' });
    }

    if (!Array.isArray(courses)) {
      return res.status(422).json({ error: 'La respuesta no es un array válido' });
    }

    const valid = courses.filter((c) => c && c.name);
    return res.status(200).json({ courses: valid, total: courses.length, model: attempt.model });
  }

  return res.status(lastError?.status || 500).json({
    error: lastError?.message || 'No se pudo generar el horario con ningún modelo disponible',
    triedModels: attempts.map((a) => a.model),
  });
}
