# SD Proxy

## TL;DR
Multi-backend image generation proxy with web UI and login protection. Supports 15+ backends (A1111, ComfyUI, GPT Image, NovelAI, PixAI, Kie.ai, Naistera, etc.) with OpenAI-compatible API. Features: prompt AI, queue system, history, gallery, real-time progress, export/import.

**Quick start:** `git clone → npm install → npm start → http://localhost:3001 → admin/admin`

---

Full-featured image generation proxy with OpenAI-compatible API, comprehensive web dashboard, and login protection.

## Quick Start

```bash
git clone https://github.com/platberlitz/sd-proxy.git
cd sd-proxy
npm install
npm start
# Open http://localhost:3001
# Login: admin / admin
```

## Authentication

- **Default credentials:** `admin` / `admin`
- **Custom credentials:** Set `ADMIN_USER` and `ADMIN_PASS` environment variables
- **Session security:** Set `SESSION_SECRET` for production
- **API access:** `/api/*` endpoints require login by default (`API_AUTH_REQUIRED=true`)
- **Public API exceptions:** `/api/session`, `/api/progress/:sessionId`, `/api/logs/:sessionId`
- **Legacy mode:** Set `API_AUTH_REQUIRED=false` to make `/api/*` public again (not recommended)
- **No-login mode:** Set `LOGIN_REQUIRED=false` or `DISABLE_LOGIN=true` to remove the login page and make the UI/API routes public

```bash
# Custom credentials example
ADMIN_USER="myuser" ADMIN_PASS="mypass" npm start
```

```bash
# API compatibility toggles
API_AUTH_REQUIRED=false npm start                    # legacy public /api/*
LOGIN_REQUIRED=false npm start                      # no web login page
ALLOW_LOCAL_URL_OVERRIDE=false npm start            # ignore x-local-url header entirely
MODEL_PROXY_ALLOWED_HOSTS="api.openai.com,openrouter.ai" npm start
```

## Supported Backends

| Backend | API Key | Notes |
|---------|---------|-------|
| **Local A1111** | No | Full control, all local features |
| **Local ComfyUI** | No | Advanced workflows |
| **Pollinations** | No (free) | No signup, instant use |
| **Pollinations (Paid)** | Yes | Pollinations Pollen API, OpenAI-compatible image endpoint |
| **GPT Image** | Yes | OpenAI GPT Image with optional reverse proxy URL |
| **NanoGPT** | Yes | Flux models, fast |
| **Gemini (Nano Banana)** | Yes | Google's native image gen, reference images, optional reverse proxy URL |
| **Kie.ai** | Yes | Multi-model media generation (Nano Banana 2, Imagen4, Flux, GPT Image 2, Wan2.7, Qwen Image 2.0, more) |
| **NovelAI** | Yes | Anime-focused, SMEA, variety+, optional reverse proxy URL |
| **Naistera** | Yes | Simple API with presets |
| **CivitAI** | Yes | Community models, LoRAs, ControlNet |
| **PixAI** | Yes | Anime-focused, LoRA support |
| **Stability AI** | Yes | Official SDXL |
| **Replicate** | Yes | Many model options |
| **Fal.ai** | Yes | Fast inference |
| **Together AI** | Yes | Cost-effective |
| **Custom** | Optional | Any OpenAI-compatible endpoint (chat/completions supported) |

---

## Tabs Overview

The UI is organized into two rows of tabs:

### General Tabs (Work with all backends)

| Tab | Description |
|-----|-------------|
| **Generate** | Main text-to-image generation. Select backend, enter prompt, adjust settings. Each backend shows only its supported settings. |
| **Prompt AI** | AI-powered prompt generation using LLMs (DeepSeek, OpenRouter, OpenAI, or custom). Generates Danbooru tags or natural descriptions from simple requests. |
| **Queue** | Queue multiple generation jobs to process sequentially. Add prompts to queue and process all at once. |
| **History** | Searchable history of all generations with thumbnails. Click ↩ (or right-click) on any thumbnail to reload its prompt, backend and settings into Generate; right-click to move it into a folder or remove it. |
| **Gallery** | Masonry-layout gallery of favorited images. Star images from results to add here. |
| **Console** | Real-time logs showing API requests, responses, and errors. Session-isolated for multi-user setups. |
| **Settings** | Configure local URLs, default quality tags, manage presets/templates, keyboard shortcuts, export/import data. |

### Local Tabs (Require Local A1111/ComfyUI)

| Tab | Description |
|-----|-------------|
| **Img2Img** | Transform existing images with adjustable denoising strength. Upload source image, set strength (0-1), generate. |
| **Inpaint** | Paint masks on images to edit specific areas. Draw with adjustable brush, invert mask, choose fill mode. |
| **Outpaint** | Extend images beyond their borders. Choose direction (left/right/up/down) and pixel amount. |
| **Upscale** | Upscale images 2x or 4x using ESRGAN, R-ESRGAN, or Anime6B upscalers. |
| **ControlNet** | Guided generation using control images. Supports Canny, Depth, OpenPose, Lineart, Scribble, Tile preprocessors. |
| **LoRAs** | Browse and search LoRAs from A1111. Click to insert into prompt with weight. |
| **Tools** | Auto-caption, image comparison, X/Y/Z plot, batch generation, prompt interpolation, regional prompting helper. |
| **Models** | Switch A1111 models/VAEs, download from Civitai. |

---

## Backend-Specific Settings

Each backend only shows settings it actually supports:

| Backend | Width/Height | Steps | CFG | Seed | Sampler | Batch | Negative | Ref Images |
|---------|-------------|-------|-----|------|---------|-------|----------|------------|
| Local A1111 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| ComfyUI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Pollinations | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Pollinations (Paid) | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| GPT Image | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| NanoGPT | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Gemini | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Kie.ai | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| NovelAI | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Naistera | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| CivitAI | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| PixAI | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Stability | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Replicate | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Fal.ai | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Together | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Custom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Backend-Specific Panels

**CivitAI**
- Model URN: Use format `urn:air:sd1:checkpoint:civitai:MODEL_ID@VERSION_ID`
- Schedulers: EulerA, Euler, DPM++ variants, DDIM, PLMS, UniPC
- CLIP Skip: 1-12 layers
- Additional Networks: LoRAs in JSON format `{"urn": {"type": "Lora", "strength": 1.0}}`
- Batch Size: 1-4 images
- **Job-based system**: Uses polling for completion (10-minute timeout)

**Gemini (Nano Banana)**
- Model: Nano Banana (2.5 Flash) or Nano Banana Pro (3 Pro)
- Aspect Ratio: 1:1, 9:16, 16:9, 4:3, 3:4
- Supports reference images for image-to-image and style transfer
- Optional reverse proxy URL. Use a base URL or full `:generateContent` endpoint.

**GPT Image**
- Models: GPT Image 2, GPT Image 1.5, GPT Image 1, GPT Image 1 Mini
- Size: Auto, 1024x1024, 1024x1536, 1536x1024
- Quality: Auto, Low, Medium, High
- Background: Auto, Opaque, Transparent
- Optional reverse proxy URL. Use a base URL or full `/v1/images/generations` endpoint.

**Kie.ai**
- Models: Nano Banana, **Nano Banana 2**, Nano Banana Edit, Nano Banana Pro, Imagen4 (Fast/Standard/Ultra), Flux-2 (Pro/Flex), GPT-4o Image, GPT Image 1.5, **GPT Image 2**, **Wan2.7 Image**, **Qwen Image 2.0**, HappyHorse-1.0 video models, Grok Imagine, Qwen, Seedream 4.5, Ideogram Character, Z-Image, Topaz Image Upscale, Recraft Crisp Upscale, Recraft Remove Background
- Aspect Ratio: 4:3, 3:4, 16:9, 9:16, 3:2, 2:3
- Resolution: 1K or 2K
- Output Format: PNG or JPG
- Supports reference images by uploading and attaching hosted URLs

**NovelAI**
- Models: V4.5 Curated/Full, V4 Curated/Full, V3 Anime, V3 Furry
- Samplers: Euler Ancestral, Euler, DPM++ variants, DDIM
- SMEA/SMEA DYN, CFG Rescale, Decrisper, Quality Tags, Variety+
- UC Presets: Low Quality + Bad Anatomy, Heavy, Light, None
- Optional reverse proxy URL. Use a base URL or full `/ai/generate-image` endpoint.
- **Artist/Style Tags**: 70+ artists, 50+ styles with search and 🎲 randomizer
- **Anlas Cost Estimator**: Shows estimated cost before generating

**Naistera**
- Aspect Ratio: 1:1, 16:9, 9:16, 3:2, 2:3
- Presets: Digital Art, Realism
- Count: 1-4 images with automatic prompt variety
- **Artist/Style Tags**: Same searchable tags as NovelAI
- **Auto-prompt limiting**: Prompts truncated to 250 chars to prevent timeouts

**PixAI**
- Model ID: Get from PixAI URL (pixai.art/model/**MODEL_ID**)
- LoRAs: Comma-separated id:weight pairs (e.g., `123456:0.8, 789012:0.6`)
- **Model/LoRA Library**: Save and manage frequently used models and LoRAs

**ComfyUI**
- **Workflow Library**: Save and load multiple workflows by name

---

## Custom Backend

The Custom backend accepts any OpenAI-compatible endpoint. It supports both:

- `/v1/images/generations` - Standard image generation endpoint
- `/v1/chat/completions` - Chat completions endpoint (auto-detected)

If your URL doesn't end with either endpoint, `/chat/completions` is appended automatically.

**Features:**
- Reference images sent as `image_url` content parts
- Extracts image URLs from response `message.images` or markdown in content
- Full settings support (all common settings shown)

**Example custom endpoints:**
- `https://api.example.com/v1` → becomes `/v1/chat/completions`
- `https://api.example.com/v1/chat/completions` → used as-is
- `https://api.example.com/v1/images/generations` → used as-is

---

## Features

### Generation Features
- **Size Presets** - Quick selection of common resolutions (SD 1.5 and SDXL)
- **Reference Images** - Upload up to 15 images for guided generation (Gemini, Custom)
- **Extra Instructions** - Additional text for the model (Gemini, Custom)
- **40+ Style Presets** - Anime, Photorealistic, Cyberpunk, Ghibli, etc.
- **Wildcards** - `{red|blue|green} hair` for random selection
- **Prompt Matrix** - `[a|b] [c|d]` generates all 4 combinations
- **Prompt Autocomplete** - 150+ Danbooru tags with Tab completion
- **Generation Timer** - Shows elapsed time for each generation
- **Seed Increment** - Quick +1 button for seed variations
- **Seed Reuse** - Each result card shows the seed that produced it (A1111, ComfyUI, Pollinations, NovelAI); click it to lock that seed
- **Live Preview** - A1111 generations stream their in-progress preview into the result area
- **Paste / Drop Images** - Ctrl+V or drag & drop images onto the Generate tab to add reference images, or onto any local tab to fill its drop zone
- **Backend Capability Hint** - The line under the backend selector lists what that backend accepts (API key, size, steps, CFG, seed, sampler, batch, negative, reference images)

### Prompt Tools
- **Prompt History** - Recall last 50 prompts with one click
- **Negative Presets** - Quick presets for Quality/Anatomy/Style/Artifacts/NSFW issues
- **Prompt Interpolation** - Blend between two prompts with adjustable steps
- **Regional Prompting Helper** - Build A1111 Regional Prompter syntax easily

### Comparison & Testing
- **A/B Testing** - Compare two different prompts side-by-side
- **Multi-Backend Comparison** - Generate same prompt across multiple backends
- **X/Y/Z Plot** - Grid comparison of different settings

### Prompt AI
- **Providers**: DeepSeek, OpenRouter, OpenAI, or custom endpoint
- **Dynamic Models**: Fetches available models from `/v1/models`
- **Styles**: Danbooru tags (anime) or natural descriptions (realistic)
- **Naistera Mode**: Optional 250-character limit for Naistera compatibility
- **One-Click**: Transfer generated prompt directly to Generate tab

### Organization
- **Favorites with Tags** - Label favorites and filter by tag
- **Folder Organization** - Organize history into folders (right-click a thumbnail → 📁 folder; × on a folder chip deletes it)
- **Reuse from History** - Restore prompt, negative, backend and per-backend settings from any history entry
- **Search History** - Find past generations by prompt text
- **Copy Prompt** - One-click copy from any history item
- **Bulk Download** - Download all favorites at once

### Backend-Specific
- **NovelAI Artist/Style Tags** - 70+ artists, 50+ styles with search and randomizer
- **NovelAI Anlas Estimator** - See cost before generating
- **Naistera Variety Generation** - Multiple images with automatic prompt variations
- **PixAI Model/LoRA Library** - Save and manage models and LoRAs
- **ComfyUI Workflow Library** - Save and load multiple workflows
- **LoRA Browser** - Search and insert LoRAs from A1111

### Data Management
- **Export/Import All** - Backup settings, presets, templates, history, favorites, folders, costs
- **Batch Prompt Import** - Load prompts from .txt file (one per line)

### Session Isolation
Multi-user safe with session-based isolation:
- Each browser gets unique session ID
- Progress updates only show for your generations
- Console logs only show your requests
- Safe for shared/remote deployments

### Console Logging
Real-time visibility into what's happening:
- API requests with backend and prompt info
- Response status and image counts
- Errors with full details
- Color-coded (red for errors, yellow for warnings)

---

### Security & Deployment

**Authentication:**
- Web dashboard protected by login (default: admin/admin)
- `/api/*` endpoints require login by default (except session/log SSE bootstrap paths)
- Session-based authentication with configurable credentials

**Network safety defaults:**
- `x-local-url` overrides are enabled by default, but restricted to loopback hosts only (`127.0.0.1`, `localhost`, `::1`)
- Set `ALLOW_LOCAL_URL_OVERRIDE=false` to ignore `x-local-url` headers entirely
- `/proxy/models` requires login and blocks private/local hosts unless explicitly allowed via `MODEL_PROXY_ALLOWED_HOSTS`

**Production Setup:**
```bash
# Set custom credentials
export ADMIN_USER="your-username"
export ADMIN_PASS="your-secure-password"
export SESSION_SECRET="your-random-secret-key"

# Start with PM2 for production
npm install -g pm2
pm2 start server.js --name sd-proxy
pm2 startup
pm2 save
```

**Reverse Proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## API Reference

### Generate Image

```bash
POST /v1/images/generations
```

```bash
curl http://localhost:3001/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-Backend: gemini" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-Session-Id: your-session-id" \
  -d '{
    "prompt": "a cat in a garden",
    "reference_images": ["data:image/png;base64,..."],
    "gemini": {
      "model": "gemini-2.5-flash-image",
      "aspect_ratio": "16:9"
    }
  }'
```

### Headers

| Header | Description |
|--------|-------------|
| `X-Backend` | Backend to use (local, gemini, novelai, etc.) |
| `X-Local-Url` | Optional local target URL (loopback-only by default, e.g. `http://127.0.0.1:7860`) |
| `X-Custom-Url` | Custom endpoint URL |
| `X-GPT-Image-Proxy-Url` | Optional GPT Image reverse proxy base URL or `/v1/images/generations` endpoint |
| `X-NovelAI-Proxy-Url` | Optional NovelAI reverse proxy base URL or `/ai/generate-image` endpoint |
| `X-Gemini-Proxy-Url` | Optional Gemini/Nano Banana reverse proxy base URL or `:generateContent` endpoint |
| `X-Session-Id` | Session ID for isolated logs/progress |
| `Authorization` | `Bearer <api_key>` |

### Backend-Specific Body Parameters

**Gemini:**
```json
{
  "gemini": {
    "model": "gemini-2.5-flash-image",
    "aspect_ratio": "16:9"
  }
}
```

**GPT Image:**
```json
{
  "gptimage": {
    "model": "gpt-image-2",
    "size": "1024x1024",
    "quality": "high",
    "background": "auto"
  }
}
```

**NovelAI:**
```json
{
  "nai": {
    "model": "nai-diffusion-4-5-curated",
    "sampler": "k_euler_ancestral",
    "steps": 28,
    "scale": 5,
    "cfg_rescale": 0,
    "smea": true,
    "smea_dyn": false,
    "variety_plus": false
  }
}
```

**Naistera:**
```json
{
  "naistera": {
    "aspect_ratio": "16:9",
    "preset": "digital"
  }
}
```

### All Endpoints

```
POST /v1/images/generations     Generate images
POST /v1/chat/completions       Chat-based generation
GET  /v1/models                 List backends

GET  /api/session               Get new session ID
GET  /api/progress/:sessionId   SSE progress stream
GET  /api/logs/:sessionId       SSE logs stream

POST /api/upscale               Upscale image (Local)
POST /api/interrogate           Auto-caption (Local)
POST /api/interrupt             Stop generation (Local)
GET  /api/a1111/models          List models/VAEs/LoRAs (Local)
POST /api/a1111/model           Switch model/VAE (Local)
POST /api/controlnet/preprocess Preprocess for ControlNet (Local)

POST /api/enhance-prompt        AI prompt enhancement
POST /api/xyz-plot              X/Y/Z comparison grid
POST /api/batch-file            Batch from prompts list
POST /api/metadata              Extract PNG metadata

GET/POST/DELETE /api/queue      Queue management
GET/POST/DELETE /api/history    History management
GET/POST/DELETE /api/favorites  Favorites management
GET/POST/DELETE /api/presets    Presets management
GET/POST/DELETE /api/templates  Templates management
GET/POST/DELETE /api/folders    Folders management
GET/DELETE /api/costs           Cost tracking
```

---

## Local Setup

### Automatic1111 WebUI

**1. Start A1111 with API enabled:**
```bash
./webui.sh --api --listen
```
Or on Windows, edit `webui-user.bat` and add `--api` to `COMMANDLINE_ARGS`.

**2. In SD Proxy:**
- Select "Local A1111" backend
- Set URL in Settings tab (default: `http://127.0.0.1:7860`)
- Generate!

All settings (prompt, negative, size, steps, CFG, sampler, seed, hires fix, etc.) work automatically.

### ComfyUI

ComfyUI uses workflow files instead of simple parameters.

**1. Start ComfyUI:**
```bash
python main.py
```

**2. Create your workflow in ComfyUI's web interface**

**3. Export workflow:**
- Enable Dev Mode: Settings → Enable Dev Mode Options
- Click "Save (API Format)" to download the workflow JSON

**4. In SD Proxy:**
- Select "ComfyUI" backend
- Set URL in Settings tab (default: `http://127.0.0.1:8188`)
- Paste your workflow JSON into the textarea
- Use placeholders in your workflow that SD Proxy will replace:
  - `%prompt%` → your prompt
  - `%negative%` → negative prompt
  - `%seed%` → seed value
  - `%width%` → width
  - `%height%` → height
  - `%steps%` → steps
  - `%cfg%` → CFG scale

**Example:** In your workflow's KSampler node, set seed to `%seed%` and it will be replaced with the actual seed value.

---

## Prompt Syntax

```
{red|blue|green} hair    → Wildcard: randomly picks one
[happy|sad] [cat|dog]    → Matrix: generates all 4 combinations
(important:1.3)          → Weight: increase/decrease emphasis
<lora:name:0.7>          → LoRA: apply with weight
prompt1 BREAK prompt2    → Regional: different areas
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Generate |
| `Ctrl + S` | Save preset |
| `Ctrl + Q` | Add to queue |
| `←` / `→` | Navigate gallery |
| `Escape` | Close modal |
| `Tab` | Autocomplete tag |

---

## UI Buttons Reference

### Generate Tab
| Button | Action |
|--------|--------|
| Generate | Start generation (page title shows ⏳ while running; Console tab badge counts errors logged while you're elsewhere) |
| + Queue | Add current settings to queue |
| Matrix | Generate all wildcard combinations |
| A/B Test | Compare two prompts |
| 🔀 Compare | Compare across backends |
| 💾 Preset | Save current settings |
| 🎲 | Random seed |
| +1 | Increment seed |
| ✨ Enhance | AI-enhance prompt |
| 📝 Templates | Show saved templates |
| 📜 History | Show prompt history |

### Result Cards
| Button | Action |
|--------|--------|
| View | Open in modal |
| i2i | Send to Img2Img |
| ⭐ | Add to favorites |
| ⬇ | Download |
| 🌱 seed | Reuse this image's seed |

### History Tab
| Button | Action |
|--------|--------|
| ↩ | Reload prompt, backend & settings into Generate |
| 📋 | Copy prompt |
| Right-click | Reuse settings, move to folder, remove from history |

### Gallery Tab
| Button | Action |
|--------|--------|
| 🏷️ | Add/edit tags on favorite |
| 📥 Download All | Download all favorites |

---

## License

MIT
