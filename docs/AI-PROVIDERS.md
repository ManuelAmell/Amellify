# 🤖 Proveedores de Inteligencia Artificial — Amellify v3

Amellify v3 cuenta con un **Escáner Inteligente de Horarios** que utiliza modelos de Visión Multimodal (Vision LLMs) para extraer automáticamente asignaturas, docentes, aulas y bloques horarios desde fotografías o capturas de pantalla de horarios universitarios.

Para garantizar alta disponibilidad y cero costos operativos para los estudiantes, Amellify incorpora una **arquitectura de cascada con respaldo automático (AI Cascade)**: si un proveedor alcanza su límite de peticiones (Rate Limit 429) o sufre una interrupción temporal, el sistema conmuta instantáneamente al siguiente proveedor configurado sin interrumpir la experiencia del usuario.

---

## 🏗️ Cómo Funciona la Cascada (Cascade Fallback)

```
        [ Imagen de Horario ]
                 │
                 ▼
      ┌─────────────────────┐
      │ 1. Gateway Propio   │ ─── Éxito ───► Horario Estructurado (JSON)
      └─────────────────────┘   (solo si configuraste AI_GATEWAY_URL — va
                 │ (Fallo)        primero porque elegiste enrutar tú mismo)
                 ▼
      ┌─────────────────────┐
      │ 2. Google Gemini    │ ─── Éxito ───► Horario Estructurado (JSON)
      └─────────────────────┘
                 │ (Fallo / 429 Rate Limit)
                 ▼
      ┌─────────────────────┐
      │ 3. Groq (Llama/Qwen)│ ─── Éxito ───► Horario Estructurado (JSON)
      └─────────────────────┘
                 │ (Fallo / 429 Rate Limit)
                 ▼
      ┌─────────────────────┐
      │ 4. OpenRouter       │ ─── Éxito ───► Horario Estructurado (JSON)
      └─────────────────────┘   (varios modelos ":free", probados en orden)
                 │ (Fallo / 429 Rate Limit)
                 ▼
      ┌─────────────────────┐
      │ 5. Mistral AI       │ ─── Éxito ───► Horario Estructurado (JSON)
      └─────────────────────┘
```

> [!TIP]
> Solo necesitas configurar **al menos uno** de los proveedores. No es obligatorio tener todos activos, pero configurar dos o más garantiza tolerancia a fallos.

> [!NOTE]
> **Latencia en el peor caso:** cada proveedor tiene un timeout de 25s antes de pasar al siguiente (`src/lib/ai/cascade.ts`). Si configuras los 7 saltos posibles (gateway + Google + Groq + 3 modelos de OpenRouter + Mistral) y varios fallan en cadena, una sola petición puede tardar hasta ~3 minutos. Si pones un reverse proxy propio delante de Amellify (fuera del perfil `caddy` incluido, que no impone timeout), asegúrate de que su timeout de lectura sea de al menos 3-4 minutos, o reduce cuántos proveedores configuras.

---

## 🔑 Obtención de API Keys Gratuitas

### 1. Google AI Studio (Gemini 2.5 / 2.0 Flash) — *Recomendado*
Google ofrece el nivel gratuito más generoso para tareas de visión multimodal y extracción estructurada con esquemas Zod.

- **Costo:** 100% Gratuito (hasta 15 peticiones por minuto y 1.500 al día).
- **Cómo obtener la clave:**
  1. Ingresa a [aistudio.google.com](https://aistudio.google.com/).
  2. Inicia sesión con cualquier cuenta de Google.
  3. Haz clic en **"Get API key"** en la barra lateral izquierda.
  4. Selecciona **"Create API key in new project"** y copia el token generado.
- **Configuración en `.env`:**
  ```env
  GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
  # Opcional: sobrescribe el modelo por defecto (gemini-2.5-flash)
  # GOOGLE_MODEL=gemini-2.5-flash
  ```

---

### 2. Groq (Llama 3.2 Vision) — *Ultrarrápido*
Groq ejecuta modelos de lenguaje en unidades de procesamiento de lenguaje (LPUs), entregando respuestas casi instantáneas (sub-segundo).

- **Costo:** Nivel gratuito disponible para desarrolladores.
- **Cómo obtener la clave:**
  1. Visita [console.groq.com](https://console.groq.com/).
  2. Regístrate o inicia sesión con tu cuenta de GitHub o Google.
  3. En la sección lateral, selecciona **"API Keys"**.
  4. Haz clic en **"Create API Key"**, asigna un nombre descriptivo y copia la clave generada (`gsk_...`).
- **Configuración en `.env`:**
  ```env
  GROQ_API_KEY=gsk_...
  # Opcional: sobrescribe el modelo por defecto (verifica el vigente en
  # console.groq.com/docs/vision — Groq rota sus modelos de visión gratuitos)
  # GROQ_MODEL=qwen/qwen3.6-27b
  ```

---

### 3. OpenRouter (Múltiples Modelos Gratuitos y de Pago)
OpenRouter agrega cientos de modelos de IA tras una API unificada compatible con OpenAI. Cuenta con modelos con el tag `:free`.

- **Costo:** Acceso a modelos gratuitos de la comunidad y modelos premium bajo prepago.
- **Modelos gratuitos que Amellify intenta por defecto, en orden** (cada uno es un salto independiente de la cascada, con su propio cooldown si falla): `google/gemma-3-27b-it:free`, `meta-llama/llama-3.2-11b-vision-instruct:free`, `qwen/qwen2.5-vl-32b-instruct:free`.
- **Cómo obtener la clave:**
  1. Entra a [openrouter.ai](https://openrouter.ai/).
  2. Inicia sesión con Google, Discord o MetaMask.
  3. Ve a tu perfil en la esquina superior derecha y selecciona **"Keys"**.
  4. Haz clic en **"Create Key"** y copia el token (`sk-or-v1-...`).
- **Configuración en `.env`:**
  ```env
  OPENROUTER_API_KEY=sk-or-v1-...
  # Opcional: reemplaza la lista de modelos por defecto (coma-separada, sin
  # espacios) — la oferta ":free" de OpenRouter cambia con frecuencia.
  # OPENROUTER_FREE_MODELS=google/gemma-3-27b-it:free,qwen/qwen2.5-vl-32b-instruct:free
  ```

---

### 4. Mistral AI (Pixtral 12B)
Mistral dispone del modelo **Pixtral**, especializado en razonamiento visual sobre documentos complejos y tablas.

- **Costo:** Tier de experimentación gratuito en su plataforma de desarrollo (La Plateforme).
- **Cómo obtener la clave:**
  1. Entra a [console.mistral.ai](https://console.mistral.ai/).
  2. Crea tu cuenta y ve a la sección **"Codestral / API Keys"**.
  3. Crea una nueva clave API y cópiala.
- **Configuración en `.env`:**
  ```env
  MISTRAL_API_KEY=tu_clave_de_mistral
  ```

---

### 5. Gateway Propio / Endpoint Compatible con OpenAI (Ollama, LiteLLM, OmniRoute, vLLM)
Si prefieres máxima privacidad ejecutando modelos localmente en tu propio servidor (ej. Ollama con `llama3.2-vision`) o enrutar tú mismo entre varios proveedores con tu propio gateway (LiteLLM, OmniRoute): este es el **primer** salto de la cascada cuando está configurado (ver diagrama arriba), porque elegiste explícitamente controlar el enrutamiento.

- **Requisitos:** Un endpoint HTTP compatible con el protocolo `/v1/chat/completions` de OpenAI.
- **Configuración en `.env`:**
  ```env
  AI_GATEWAY_URL=http://localhost:11434/v1
  AI_GATEWAY_KEY=ollama
  # Opcional: modelo a pedirle al gateway (por defecto gpt-4o-mini, que en
  # un gateway propio normalmente mapea a lo que tú definas)
  AI_GATEWAY_MODEL=llama3.2-vision
  ```

---

## 📋 Resumen de Variables de Entorno

| Variable | Proveedor | Modelo por defecto | Obligatoria |
|---|---|---|---|
| `AI_GATEWAY_URL` / `AI_GATEWAY_KEY` | Tu gateway propio (Ollama, LiteLLM, OmniRoute...) | `AI_GATEWAY_MODEL` (def. `gpt-4o-mini`) | Opcional |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI Studio | `GOOGLE_MODEL` (def. `gemini-2.5-flash`) | Recomendada |
| `GROQ_API_KEY` | Groq Console | `GROQ_MODEL` (def. `qwen/qwen3.6-27b`) | Recomendada |
| `OPENROUTER_API_KEY` | OpenRouter | `OPENROUTER_FREE_MODELS` (lista, ver arriba) | Opcional |
| `MISTRAL_API_KEY` | Mistral AI | `MISTRAL_MODEL` (def. `pixtral-12b-2409`) | Opcional |

> [!IMPORTANT]
> Los nombres de arriba son los que realmente lee `src/lib/ai/providers.ts` — son los mismos que `.env.example`. Los modelos gratuitos cambian con frecuencia por parte de cada proveedor; si un default deja de funcionar, sobrescríbelo con la variable `*_MODEL`/`OPENROUTER_FREE_MODELS` correspondiente sin tocar código.

---

## 🧪 Pruebas y Consejos para la Extracción de Horarios

1. **Formatos soportados:** JPG, PNG, WebP y capturas de pantalla de portales universitarios (SIA, Banner, Academusoft, etc.).
2. **Recomendaciones para una buena lectura:**
   - Asegúrate de que los textos de horas (ej. `07:00 - 09:00`) y días de la semana sean legibles.
   - En dispositivos móviles, puedes tomar una fotografía directa o subir una captura de pantalla guardada.
   - Siempre se mostrará una ventana modal de previsualización antes de guardar las materias en tu base de datos, permitiéndote editar cualquier campo extraído.
