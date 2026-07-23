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

  const { image, model } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Falta la imagen' });
  }

  const prompt = `Quiero que actúes como un generador de horarios universitarios en formato JSON. Te paso una imagen de mi horario de clases y debés devolver SOLO un arreglo JSON válido, sin markdown fences, sin explicaciones, sin texto adicional.

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

  const selectedModel = model || 'google/gemini-2.0-flash-001';

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.origin || 'https://amellify.app',
        'X-Title': 'Amellify Schedule Import',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || `Error de OpenRouter: ${response.status}`,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let raw = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
    const courses = JSON.parse(raw);

    if (!Array.isArray(courses)) {
      return res.status(422).json({ error: 'La respuesta no es un array válido' });
    }

    const valid = courses.filter(c => c && c.name);
    return res.status(200).json({ courses: valid, total: courses.length });
  } catch (e) {
    const msg = e.message || 'Error desconocido';
    if (msg.includes('JSON')) {
      return res.status(422).json({ error: 'La IA devolvió un JSON inválido. Intentá con otro modelo.' });
    }
    return res.status(500).json({ error: msg });
  }
}
