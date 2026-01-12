# SD Proxy

Multi-backend image generation proxy with OpenAI-compatible API. Connect your apps to multiple image generation backends through a single unified interface.

## Features

- 🔌 **Multiple Backends** - Local A1111/ComfyUI, Pollinations (free), NanoGPT, PixAI
- 🎯 **OpenAI-Compatible API** - Works with any app that supports OpenAI image generation
- 🎨 **Web Dashboard** - Generate images, manage LoRAs, view history
- 📦 **Civitai Integration** - Load model/LoRA info directly from Civitai URLs
- 🔄 **Chat Completions** - Image generation via chat API for SillyTavern compatibility
- 💾 **Local Storage** - History, LoRAs, and settings persist in browser

## Supported Backends

| Backend | API Key | Features |
|---------|---------|----------|
| Local (A1111/ComfyUI) | No | Full control, your own models/LoRAs |
| Pollinations | No | Free, no signup required |
| NanoGPT | Yes | Flux models, fast |
| PixAI | Yes | Anime models, LoRAs |

## Installation

```bash
npm install
npm start
```

Server runs on `http://localhost:3001`

## API Endpoints

### Generate Images
```
POST /v1/images/generations
Headers:
  X-Backend: local|pollinations|nanogpt|pixai
  X-Local-Url: http://127.0.0.1:7860 (for local backend)
  Authorization: Bearer <api_key> (if required)

Body:
{
  "prompt": "masterpiece, 1girl",
  "negative_prompt": "lowres, bad anatomy",
  "width": 512,
  "height": 768,
  "steps": 20,
  "cfg_scale": 7,
  "sampler": "Euler a",
  "seed": -1,
  "n": 1,
  "model": "model_name",
  "loras": [{"id": "123", "weight": 0.7}]
}
```

### Chat Completions (for ST)
```
POST /v1/chat/completions
Body:
{
  "messages": [{"role": "user", "content": "generate a cute cat"}]
}
```

### List Models
```
GET /v1/models
```

## Usage with SillyTavern

1. Set your reverse proxy URL to `http://localhost:3001`
2. Use the chat completions endpoint for image generation
3. Or use the ST Image Gen extension with this proxy

## Dashboard

Open `http://localhost:3001` in your browser for the web interface:
- Generate tab: Create images with any backend
- Models tab: Load Civitai model info
- LoRAs tab: Manage LoRAs for PixAI/local backends
- History tab: View recent generations
- Settings tab: Configure backends and defaults

## License

MIT
