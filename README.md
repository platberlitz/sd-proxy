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

## Local vs Online Features

### ✅ Works Online (No Local GPU Required)

These backends run entirely in the cloud - just need an API key:

| Backend | Requirements | Notes |
|---------|--------------|-------|
| **Pollinations** | Nothing (free) | No signup, instant use |
| **NanoGPT** | API key | Flux models, fast |
| **PixAI** | API key | Anime-focused, LoRA support |
| **Stability AI** | API key | Official SDXL |
| **Replicate** | API key | Many model options |
| **Fal.ai** | API key | Fast inference |
| **Together AI** | API key | Cost-effective |
| **Custom** | API key + URL | Any OpenAI-compatible endpoint |

**Online-only features:**
- Text-to-Image generation
- Reference images (Custom backend)
- Prompt AI (LLM prompt generation)
- All UI features (history, favorites, presets, etc.)

### 🖥️ Requires Local Setup

These features need software running on your computer:

| Feature | Local Requirement |
|---------|-------------------|
| **Local A1111** | [Automatic1111 WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) with `--api` flag |
| **Local ComfyUI** | [ComfyUI](https://github.com/comfyanonymous/ComfyUI) running |
| **Img2Img** | Local A1111 only |
| **Inpainting** | Local A1111 only |
| **Outpainting** | Local A1111 only |
| **Upscaling** | Local A1111 only |
| **ControlNet** | Local A1111 + [ControlNet extension](https://github.com/Mikubill/sd-webui-controlnet) |
| **Face Restore** | Local A1111 only |
| **Hires Fix** | Local A1111 only |
| **Model Switching** | Local A1111 only |
| **LoRA Browser** | Local A1111 only |
| **Auto-Caption (BLIP/CLIP)** | Local A1111 only |

### 💡 Recommendation

- **No GPU?** Use Pollinations (free) or get an API key for NanoGPT/PixAI
- **Have a GPU?** Run A1111 locally for full feature access
- **Remote server?** Host sd-proxy on a VPS, use cloud backends

---

## Features Overview

### 🎨 Generation Modes

| Mode | Description | Requires |
|------|-------------|----------|
| **Text-to-Image** | Generate from text prompts | Any backend |
| **Img2Img** | Transform images with adjustable strength | Local A1111 |
| **Inpainting** | Paint masks to edit specific areas | Local A1111 |
| **Outpainting** | Extend images beyond borders | Local A1111 |
| **Upscaling** | 2x/4x with ESRGAN, R-ESRGAN, Anime6B | Local A1111 |
| **ControlNet** | Guided generation with pose, depth, canny | Local A1111 + extension |
| **Variations** | Generate slight variations of existing images | Local A1111 |
| **Tiled/Seamless** | Create tileable textures | Local A1111 |

### 🔌 Supported Backends (10+)

| Backend | API Key | Best For |
|---------|---------|----------|
| **Local A1111** | No | Full control, all features |
| **Local ComfyUI** | No | Advanced workflows |
| **Pollinations** | No | Free, quick testing |
| **NanoGPT** | Yes | Flux models |
| **PixAI** | Yes | Anime, LoRAs |
| **Stability AI** | Yes | Official SDXL |
| **Replicate** | Yes | Model variety |
| **Fal.ai** | Yes | Fast inference |
| **Together AI** | Yes | Cost-effective |
| **Custom** | Optional | Any OpenAI-compatible API |

### 🤖 Prompt AI (NEW)

AI-powered prompt generation using LLMs:
- **Providers**: DeepSeek, OpenRouter, OpenAI, or any custom endpoint
- **Dynamic Model List**: Fetches available models from `/v1/models` API
- **Prompt Styles**: Danbooru tags (anime) or natural descriptions (realistic)
- **One-Click Transfer**: Send generated prompt directly to image generation

### 🛠️ Generation Features

- **Reference Images** - Upload up to 15 reference images for guided generation
- **Extra Instructions** - Additional text instructions for the image model
- **40+ Style Presets** - Anime, Photorealistic, Cyberpunk, Ghibli, etc.
- **Wildcards** - `{red|blue|green} hair` for random selection
- **Prompt Matrix** - `[a|b] [c|d]` generates all 4 combinations
- **Hires Fix** - Two-pass high-resolution generation
- **Face Restore** - GFPGAN/CodeFormer integration
- **Batch Generation** - Multiple images at once
- **Seed Control** - Reproducible results

### 🎛️ ControlNet Support

| Preprocessor | Use Case |
|--------------|----------|
| Canny | Edge detection |
| Depth (MiDaS) | Depth maps |
| OpenPose | Pose estimation |
| Lineart | Line extraction |
| Soft Edge | Soft boundaries |
| Scribble | Hand-drawn guides |
| Tile | Detail enhancement |

### 🔧 Tools

- **Auto-Caption** - BLIP/CLIP image interrogation
- **Prompt Enhancement** - AI improves your prompts
- **Image Comparison** - Side-by-side slider comparison
- **X/Y/Z Plot** - Compare settings in a grid
- **Batch from File** - Process multiple prompts from text
- **PNG Metadata** - Extract generation parameters

### 📦 Model Management

- **Model Switching** - Change A1111 checkpoint from UI
- **VAE Selection** - Choose VAE for generation
- **LoRA Browser** - Browse and insert LoRAs with one click
- **Civitai Download** - Download models directly from Civitai
- **Embedding Support** - Use textual inversions

### 📋 Organization

- **Queue System** - Queue prompts, process sequentially
- **History** - Searchable with thumbnails
- **Favorites** - Star and save best images
- **Folders** - Organize into collections
- **Presets** - Save/load generation settings
- **Templates** - Reusable prompt snippets
- **Export/Import** - Backup all data

### 📋 Console (NEW)

Real-time logging with session isolation:
- **Live Logs** - See generation requests, responses, and errors in real-time
- **Session Isolation** - Each user only sees their own logs (multi-user safe)
- **Auto-scroll** - Toggle auto-scroll for log output
- **Color-coded** - Errors in red, warnings in yellow

### 🖥️ User Interface

- **Dark Green Theme** - Easy on the eyes
- **Gallery View** - Masonry layout for favorites
- **Progress Bar** - Real-time generation progress
- **Image Info Overlay** - Params on hover
- **Prompt Autocomplete** - 150+ Danbooru tags
- **Prompt Tags Display** - Visual tag management
- **Drag & Drop** - Drop images anywhere
- **Mobile Responsive** - Works on all devices

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Generate |
| `Ctrl + S` | Save preset |
| `Ctrl + Q` | Add to queue |
| `←` / `→` | Navigate gallery |
| `Escape` | Close modal |

### 💰 Cost Tracking

Track API usage costs per backend with detailed breakdown.

---

## API Reference

### Generate Image

```bash
POST /v1/images/generations
```

```bash
curl http://localhost:3001/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-Backend: local" \
  -H "X-Local-Url: http://127.0.0.1:7860" \
  -H "X-Session-Id: your-session-id" \
  -d '{
    "prompt": "masterpiece, 1girl, smile",
    "negative_prompt": "lowres, bad anatomy",
    "width": 512,
    "height": 768,
    "steps": 25,
    "cfg_scale": 7,
    "sampler": "dpmpp_2m",
    "scheduler": "karras",
    "reference_images": ["data:image/png;base64,..."]
  }'
```

### Headers

| Header | Description |
|--------|-------------|
| `X-Backend` | Backend to use |
| `X-Local-Url` | A1111/ComfyUI URL |
| `X-Custom-Url` | Custom endpoint URL |
| `X-Session-Id` | Session ID for isolated logs/progress |
| `Authorization` | `Bearer <key>` |

### Body Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `prompt` | string | Image description |
| `negative_prompt` | string | What to avoid |
| `width` | number | Image width |
| `height` | number | Image height |
| `steps` | number | Sampling steps |
| `cfg_scale` | number | Prompt adherence |
| `sampler` | string | Sampling method |
| `scheduler` | string | Noise schedule |
| `seed` | number | Random seed |
| `n` | number | Batch size |
| `reference_images` | array | Base64 reference images (up to 15) |
| `init_image` | string | Base64 for img2img |
| `mask` | string | Base64 mask for inpainting |
| `strength` | number | Denoising strength |
| `controlnet` | object | ControlNet settings |
| `hires_fix` | boolean | Enable hires fix |
| `face_restore` | boolean | Face restoration |
| `tiling` | boolean | Seamless tiling |
| `outpaint` | object | Outpainting settings |

### ControlNet Object

```json
{
  "controlnet": {
    "image": "<base64>",
    "preprocessor": "canny",
    "model": "control_v11p_sd15_canny",
    "weight": 1.0,
    "guidance_start": 0,
    "guidance_end": 1
  }
}
```

### All Endpoints

```
POST /v1/images/generations     Generate images
POST /v1/chat/completions       Chat-based generation
GET  /v1/models                 List backends

GET  /api/session               Get new session ID
GET  /api/progress/:sessionId   SSE progress stream (session-isolated)
GET  /api/logs/:sessionId       SSE logs stream (session-isolated)

POST /api/upscale               Upscale image
POST /api/interrogate           Auto-caption (BLIP/CLIP)
POST /api/interrupt             Stop generation
GET  /api/a1111/progress        Generation progress
GET  /api/a1111/models          List models/VAEs/LoRAs
POST /api/a1111/model           Switch model/VAE
POST /api/controlnet/preprocess Preprocess for ControlNet
POST /api/civitai/download      Download from Civitai
POST /api/enhance-prompt        AI prompt enhancement
POST /api/xyz-plot              X/Y/Z comparison grid
POST /api/batch-file            Batch from prompts list
POST /api/metadata              Extract PNG metadata

GET  /api/queue                 List queue
POST /api/queue                 Add to queue
DELETE /api/queue/:id           Remove from queue
POST /api/queue/process         Process all

GET  /api/history               List history
DELETE /api/history             Clear history
GET  /api/favorites             List favorites
POST /api/favorites             Add favorite
GET  /api/presets               List presets
POST /api/presets               Save preset
GET  /api/templates             List templates
POST /api/templates             Save template
GET  /api/folders               List folders
POST /api/folders               Create folder
GET  /api/costs                 Cost tracking
DELETE /api/costs               Reset costs
```

---

## Local Backend Setup

### Automatic1111 WebUI

```bash
./webui.sh --api
```

For ControlNet, install the [sd-webui-controlnet](https://github.com/Mikubill/sd-webui-controlnet) extension.

### ComfyUI

```bash
python main.py
```

---

## Prompt Syntax

### Wildcards
```
{red|blue|green} hair    → randomly picks one
```

### Matrix (generates all combinations)
```
[happy|sad] [cat|dog]    → 4 images: happy cat, happy dog, sad cat, sad dog
```

### Weights
```
(important tag:1.3)      → increases weight
(less important:0.7)     → decreases weight
```

### LoRA
```
<lora:name:0.7>          → applies LoRA with weight 0.7
```

### Regional Prompting
```
prompt1 BREAK prompt2    → different prompts for different regions
```

---

## Data Storage

```
data/
├── history.json
├── favorites.json
├── folders.json
├── presets.json
├── templates.json
└── costs.json
```

---

## Environment Variables

```bash
PORT=3001
```

---

## License

MIT
