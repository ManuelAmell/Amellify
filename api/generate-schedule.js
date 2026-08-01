const FALLBACK_MODELS = [
  'google/gemini-3.6-flash',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-4o',
];

function isRecoverableError(status, message) {
  if ([402, 429, 502, 503, 404].includes(status)) return true;
  const msg = (message || '').toLowerCase();
  return ['rate limit', 'key limit', 'insufficient credits', 'no endpoints', 'overloaded', 'unavailable'].some((k) => msg.includes(k));
}

async function callModel(apiKey, model, prompt, imgs, origin) {
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
  return { ok: response.ok, status: response.status, data };
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada en el servidor' });
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

  const requestedModel = model || FALLBACK_MODELS[0];
  const attempts = [requestedModel, ...FALLBACK_MODELS.filter((m) => m !== requestedModel)].slice(0, FALLBACK_MODELS.length);

  let lastError = null;
  for (const selectedModel of attempts) {
    let result;
    try {
      result = await callModel(apiKey, selectedModel, prompt, imgs, req.headers.origin);
    } catch (e) {
      lastError = { status: 500, message: e.message || 'Error desconocido' };
      continue;
    }

    if (!result.ok) {
      const message = result.data?.error?.message || `Error de OpenRouter: ${result.status}`;
      if (isRecoverableError(result.status, message)) {
        lastError = { status: result.status, message };
        continue;
      }
      return res.status(result.status).json({ error: message });
    }

    const content = result.data.choices?.[0]?.message?.content || '';

    let raw = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
    let courses;
    try {
      courses = JSON.parse(raw);
    } catch (e) {
      return res.status(422).json({ error: 'La IA devolvió un JSON inválido. Intentá con otro modelo.' });
    }

    if (!Array.isArray(courses)) {
      return res.status(422).json({ error: 'La respuesta no es un array válido' });
    }

    const valid = courses.filter(c => c && c.name);
    return res.status(200).json({ courses: valid, total: courses.length, model: selectedModel });
  }

  return res.status(lastError?.status || 500).json({
    error: lastError?.message || 'No se pudo generar el horario con ningún modelo disponible',
    triedModels: attempts,
  });
}
