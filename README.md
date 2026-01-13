# SD Proxy

Full-featured image generation proxy with OpenAI-compatible API and comprehensive web dashboard.

## Quick Start

```bash
git clone https://github.com/platberlitz/sd-proxy.git
cd sd-proxy
npm install
npm start
# Open http://localhost:3001
```

## Supported Backends

| Backend | API Key | Notes |
|---------|---------|-------|
| **Local A1111** | No | Full control, all local features |
| **Local ComfyUI** | No | Advanced workflows |
| **Pollinations** | No (free) | No signup, instant use |
| **NanoGPT** | Yes | Flux models, fast |
| **Gemini (Nano Banana)** | Yes | Google's native image gen, reference images |
| **NovelAI** | Yes | Anime-focused, SMEA, variety+ |
| **Naistera** | Yes | Simple API with presets |
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
| **History** | Searchable history of all generations with thumbnails. Organize into folders, search by prompt. |
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
| NanoGPT | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Gemini | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| NovelAI | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Naistera | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PixAI | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Stability | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Replicate | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Fal.ai | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Together | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Custom | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Backend-Specific Panels

**Gemini (Nano Banana)**
- Model: Nano Banana (2.5 Flash) or Nano Banana Pro (3 Pro)
- Aspect Ratio: 1:1, 9:16, 16:9, 4:3, 3:4
- Supports reference images for image-to-image and style transfer

**NovelAI**
- Models: V4.5 Curated/Full, V4 Curated/Full, V3 Anime, V3 Furry
- Samplers: Euler Ancestral, Euler, DPM++ variants, DDIM
- SMEA/SMEA DYN, CFG Rescale, Decrisper, Quality Tags, Variety+
- UC Presets: Low Quality + Bad Anatomy, Heavy, Light, None
- **Artist/Style Tags**: 70+ artists, 50+ styles with search and 🎲 randomizer
- **Anlas Cost Estimator**: Shows estimated cost before generating

**Naistera**
- Aspect Ratio: 1:1, 16:9, 9:16, 3:2, 2:3
- Presets: Digital Art, Realism
- **Artist/Style Tags**: Same searchable tags as NovelAI

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
- **One-Click**: Transfer generated prompt directly to Generate tab

### Organization
- **Favorites with Tags** - Label favorites and filter by tag
- **Folder Organization** - Organize history into folders
- **Search History** - Find past generations by prompt text
- **Copy Prompt** - One-click copy from any history item
- **Bulk Download** - Download all favorites at once

### Backend-Specific
- **NovelAI Artist/Style Tags** - 70+ artists, 50+ styles with search and randomizer
- **NovelAI Anlas Estimator** - See cost before generating
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
| `X-Local-Url` | A1111/ComfyUI URL (default: http://127.0.0.1:7860) |
| `X-Custom-Url` | Custom endpoint URL |
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
| Generate | Start generation |
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

### Gallery Tab
| Button | Action |
|--------|--------|
| 🏷️ | Add/edit tags on favorite |
| 📥 Download All | Download all favorites |

---

## License

MIT
