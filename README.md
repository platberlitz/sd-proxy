# SD Proxy

Multi-backend image generation proxy with OpenAI-compatible API.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3001
```

## Supported Backends

| Backend | API Key | GPU | Best For |
|---------|---------|-----|----------|
| **Local A1111** | No | Your GPU | Full control, custom models |
| **Local ComfyUI** | No | Your GPU | Advanced workflows |
| **Pollinations** | No | Free cloud | Quick testing |
| **NanoGPT** | Yes | Cloud | Flux models |
| **PixAI** | Yes | Cloud | Anime, LoRAs |
| **Custom** | Optional | Varies | Any OpenAI-compatible API |

## API Endpoints

```
POST /v1/images/generations  - Generate images
POST /v1/chat/completions    - Chat-based generation
GET  /v1/models              - List backends
```

### Generate Image

```bash
curl http://localhost:3001/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "X-Backend: pollinations" \
  -d '{"prompt": "a cat in space", "width": 512, "height": 512}'
```

### Headers

| Header | Description |
|--------|-------------|
| `X-Backend` | `local`, `comfyui`, `pollinations`, `nanogpt`, `pixai`, `custom` |
| `X-Local-Url` | Local backend URL (default: `http://127.0.0.1:7860`) |
| `X-Custom-Url` | Custom endpoint URL |
| `Authorization` | `Bearer <key>` for backends requiring auth |

## Local Setup

### A1111 WebUI
```bash
# Start with API enabled
./webui.sh --api
# or on Windows
webui-user.bat --api
```

### ComfyUI
```bash
# Start normally (API enabled by default on port 8188)
python main.py
```

## Environment Variables

```bash
PORT=3001              # Server port
COMFYUI_URL=http://127.0.0.1:8188  # ComfyUI address
```

## License

MIT
