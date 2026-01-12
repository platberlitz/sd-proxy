# SD Proxy

Multi-backend image generation proxy with OpenAI-compatible API and feature-rich web dashboard.

![Dashboard](https://img.shields.io/badge/Dashboard-Web_UI-4ade80) ![API](https://img.shields.io/badge/API-OpenAI_Compatible-blue) ![License](https://img.shields.io/badge/License-MIT-green)

## Quick Start

```bash
git clone https://github.com/platberlitz/sd-proxy.git
cd sd-proxy
npm install
npm start
# Open http://localhost:3001
```

## Features

### 🎨 Generation Modes

| Mode | Description |
|------|-------------|
| **Text-to-Image** | Generate images from text prompts |
| **Img2Img** | Transform existing images with prompts |
| **Inpainting** | Edit specific areas with mask painting |
| **Upscaling** | Enhance resolution with ESRGAN/R-ESRGAN |

### 🔌 Supported Backends

| Backend | API Key | Features | Best For |
|---------|---------|----------|----------|
| **Local A1111** | No | Full features, LoRAs, ControlNet | Maximum control |
| **Local ComfyUI** | No | Workflow-based, flexible | Advanced users |
| **Pollinations** | No | Free, fast | Quick testing |
| **NanoGPT** | Yes | Flux models | Quality results |
| **PixAI** | Yes | Anime, LoRAs | Anime art |
| **Stability AI** | Yes | SDXL official | Production use |
| **Replicate** | Yes | Many models | Model variety |
| **Fal.ai** | Yes | Fast inference | Speed |
| **Together AI** | Yes | Open models | Cost-effective |
| **Custom** | Optional | Any OpenAI-compatible API | Flexibility |

### 🛠️ Generation Features

- **40+ Style Presets** - Anime, Photorealistic, Oil Painting, Cyberpunk, Ghibli, and more
- **Wildcards** - Random selection with `{option1|option2|option3}` syntax
- **Hires Fix** - Two-pass generation for higher resolution
- **Face Restore** - GFPGAN/CodeFormer integration
- **Batch Generation** - Generate multiple images at once
- **Seed Control** - Reproducible results with random seed button

### 📋 Organization

- **Queue System** - Queue multiple prompts, process sequentially
- **History** - Searchable generation history with thumbnails
- **Favorites** - Star and save your best images
- **Folders** - Organize history into collections
- **Presets** - Save and load generation settings
- **Export/Import** - Backup all data to JSON

### 🖥️ User Interface

- **Dark Green Theme** - Easy on the eyes
- **Prompt Autocomplete** - Danbooru tag suggestions
- **Drag & Drop** - Drop images for img2img/inpaint/upscale
- **Image Modal** - Full-size view with action buttons
- **Metadata Viewer** - Extract PNG generation parameters
- **Mobile Friendly** - Responsive design

### ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Enter` | Generate image |
| `Ctrl + S` | Save preset |
| `Ctrl + Q` | Add to queue |
| `Escape` | Close modal |

### 💰 Cost Tracking

Track API usage costs per backend with reset option.

---

## API Reference

### Generate Image

```bash
POST /v1/images/generations
```

```bash
curl http://localhost:3001/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-Backend: pollinations" \
  -d '{
    "prompt": "a cat in space, digital art",
    "negative_prompt": "blurry, low quality",
    "width": 512,
    "height": 512,
    "steps": 25,
    "cfg_scale": 7
  }'
```

#### Headers

| Header | Description |
|--------|-------------|
| `X-Backend` | `local`, `comfyui`, `pollinations`, `nanogpt`, `pixai`, `stability`, `replicate`, `fal`, `together`, `custom` |
| `X-Local-Url` | Local backend URL (default: `http://127.0.0.1:7860`) |
| `X-Custom-Url` | Custom endpoint URL |
| `Authorization` | `Bearer <api_key>` for paid backends |

#### Body Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | required | Image description |
| `negative_prompt` | string | "" | What to avoid |
| `width` | number | 512 | Image width |
| `height` | number | 768 | Image height |
| `steps` | number | 25 | Sampling steps |
| `cfg_scale` | number | 7 | Prompt adherence |
| `sampler` | string | "dpmpp_2m" | Sampling method |
| `scheduler` | string | "karras" | Noise schedule |
| `seed` | number | -1 | Random seed |
| `n` | number | 1 | Batch size |
| `init_image` | string | - | Base64 image for img2img |
| `strength` | number | 0.75 | Denoising strength |
| `mask` | string | - | Base64 mask for inpainting |
| `hires_fix` | boolean | false | Enable hires fix |
| `face_restore` | boolean | false | Enable face restoration |

### Upscale Image

```bash
POST /api/upscale
```

```bash
curl http://localhost:3001/api/upscale \
  -H "Content-Type: application/json" \
  -d '{
    "image": "<base64_image>",
    "scale": 2,
    "upscaler": "R-ESRGAN 4x+"
  }'
```

### Queue Management

```bash
GET  /api/queue              # List queue
POST /api/queue              # Add to queue
DELETE /api/queue/:id        # Remove from queue
POST /api/queue/process      # Process all queued items
```

### History & Favorites

```bash
GET    /api/history              # List history (supports ?search=&folder=&limit=&offset=)
DELETE /api/history/:id          # Delete history item
DELETE /api/history              # Clear all history

GET    /api/favorites            # List favorites
POST   /api/favorites            # Add favorite
DELETE /api/favorites/:id        # Remove favorite
```

### Presets & Folders

```bash
GET    /api/presets              # List presets
POST   /api/presets              # Save preset
DELETE /api/presets/:id          # Delete preset

GET    /api/folders              # List folders
POST   /api/folders              # Create folder
DELETE /api/folders/:id          # Delete folder
```

### Other Endpoints

```bash
GET  /v1/models                  # List backends
POST /v1/chat/completions        # Chat-based generation (ST compatible)
GET  /api/costs                  # Get cost tracking data
DELETE /api/costs                # Reset costs
POST /api/metadata               # Extract PNG metadata
GET  /proxy/models?url=&key=     # Proxy for fetching external model lists
```

---

## Local Backend Setup

### Automatic1111 WebUI

```bash
# Start with API enabled
./webui.sh --api
# or Windows
webui-user.bat --api
```

Default URL: `http://127.0.0.1:7860`

### ComfyUI

```bash
# API enabled by default
python main.py
```

Default URL: `http://127.0.0.1:8188`

---

## Environment Variables

```bash
PORT=3001                              # Server port
```

---

## Data Storage

All data is stored in the `data/` directory:

```
data/
├── history.json      # Generation history
├── favorites.json    # Favorited images
├── folders.json      # Folder organization
├── presets.json      # Saved presets
└── costs.json        # Cost tracking
```

---

## Wildcard Syntax

Use curly braces with pipe-separated options for random selection:

```
{red|blue|green} hair, {happy|sad|angry} expression
```

Each generation randomly picks one option from each wildcard.

---

## Style Presets

Available styles that append tags to your prompt:

- Anime, Photorealistic, Digital Art, Oil Painting, Watercolor
- Pencil Sketch, Ink Drawing, Pixel Art, 3D Render
- Cyberpunk, Fantasy, Comic Book, Manga, Chibi, Ghibli
- Film Noir, Vaporwave, Dark Fantasy, Cinematic
- And many more...

---

## Tips

1. **Free Generation**: Use Pollinations backend - no API key needed
2. **Best Quality**: Local A1111 with custom models and LoRAs
3. **Fastest**: Fal.ai or Pollinations
4. **Anime**: PixAI with anime models and LoRAs
5. **Inpainting**: Only works with Local A1111 backend
6. **Upscaling**: Requires Local A1111 with ESRGAN models

---

## License

MIT
