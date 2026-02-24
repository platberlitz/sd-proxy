const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const { execSync } = require('child_process');
const app = express();

// Auth config
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

app.use(express.json({ limit: '100mb' }));
app.use(session({ secret: process.env.SESSION_SECRET || 'sd-proxy-secret', resave: false, saveUninitialized: false }));

// Auth middleware
function auth(req, res, next) {
    if (req.session.loggedIn) return next();
    if (req.path === '/login' || req.path.startsWith('/api/')) return next();
    res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => res.send(`
<!DOCTYPE html><html><head><title>Login - SD Proxy</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{font-family:system-ui;background:#0d1a0d;color:#c8e6c9;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}.card{background:#1a2e1a;padding:2rem;border-radius:12px;width:100%;max-width:360px;border:1px solid #2d5a2d}h1{margin:0 0 1.5rem;text-align:center;color:#4caf50}input{width:100%;padding:12px;margin:8px 0;border:1px solid #2d5a2d;border-radius:6px;background:#0d1a0d;color:#c8e6c9}button{width:100%;padding:12px;background:#4caf50;border:none;border-radius:6px;color:#fff;font-size:16px;cursor:pointer;margin-top:12px}button:hover{background:#66bb6a}.error{color:#f44336;text-align:center;margin-top:8px}</style></head>
<body><div class="card"><h1>🎨 SD Proxy</h1><form method="POST" action="/login">
<input name="user" placeholder="Username" required>
<input name="pass" type="password" placeholder="Password" required>
<button type="submit">Login</button>
${req.query.error ? '<p class="error">Invalid credentials</p>' : ''}
</form></div></body></html>`));

app.post('/login', express.urlencoded({ extended: true }), (req, res) => {
    if (req.body.user === ADMIN_USER && req.body.pass === ADMIN_PASS) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

function requireAuth(req, res, next) {
    if (req.session.loggedIn) return next();
    res.status(401).json({ error: 'Authentication required' });
}

app.use(auth);
app.use(express.static('public'));

// Data storage
const MODELS_DIR = path.join(__dirname, 'models');
[MODELS_DIR].forEach(d => fs.existsSync(d) || fs.mkdirSync(d));

let queue = [], currentGeneration = null;

function safeFilename(name, fallback = 'model.safetensors') {
    const raw = String(name || '').trim();
    const base = path.basename(raw).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base || fallback;
}

// SSE clients
const sseClients = new Map();

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve dashboard
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Session endpoint - get unique session ID
app.get('/api/session', (req, res) => {
    const sessionId = crypto.randomUUID();
    res.json({ sessionId });
});

// SSE endpoints
app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!sseClients.has(sessionId)) sseClients.set(sessionId, {});
    sseClients.get(sessionId).progress = res;
    req.on('close', () => { const c = sseClients.get(sessionId); if (c) { delete c.progress; if (!Object.keys(c).length) sseClients.delete(sessionId); } });
});

app.get('/api/logs/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!sseClients.has(sessionId)) sseClients.set(sessionId, {});
    sseClients.get(sessionId).logs = res;
    req.on('close', () => { const c = sseClients.get(sessionId); if (c) { delete c.logs; if (!Object.keys(c).length) sseClients.delete(sessionId); } });
});

function sendProgress(sessionId, data) {
    const client = sseClients.get(sessionId);
    if (client?.progress) client.progress.write(`data: ${JSON.stringify(data)}\n\n`);
}

function log(sessionId, message, level = 'info') {
    const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
    console.log(entry);
    const client = sseClients.get(sessionId);
    if (client?.logs) client.logs.write(`data: ${JSON.stringify({ message, level })}\n\n`);
}

// Prompt matrix expansion: [a|b] [c|d] -> 4 prompts
function expandMatrix(prompt) {
    const matches = prompt.match(/\[([^\]]+)\]/g);
    if (!matches) return [prompt];
    const options = matches.map(m => m.slice(1, -1).split('|'));
    const combinations = options.reduce((acc, opts) => acc.flatMap(a => opts.map(o => [...a, o])), [[]]);
    return combinations.map(combo => {
        let result = prompt;
        matches.forEach((m, i) => { result = result.replace(m, combo[i]); });
        return result;
    });
}

// Wildcard expansion: {a|b|c} -> random pick
function expandWildcards(text) {
    return text.replace(/\{([^}]+)\}/g, (m, p) => {
        const opts = p.split('|');
        return opts[Math.floor(Math.random() * opts.length)];
    });
}

// Backend handlers
const A1111_SAMPLERS = { euler_ancestral: 'Euler a', euler: 'Euler', dpmpp_2m: 'DPM++ 2M', dpmpp_2m_sde: 'DPM++ 2M SDE', dpmpp_2s_ancestral: 'DPM++ 2S a', dpmpp_sde: 'DPM++ SDE', dpm_2: 'DPM2', dpm_2_ancestral: 'DPM2 a', heun: 'Heun', lms: 'LMS', ddim: 'DDIM', ddpm: 'DDPM', uni_pc: 'UniPC', lcm: 'LCM' };

const backends = {
    async local(body, headers, sessionId) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:7860';
        const sampler = A1111_SAMPLERS[body.sampler] || body.sampler || 'DPM++ 2M';
        const samplerName = body.scheduler === 'karras' ? sampler + ' Karras' : body.scheduler === 'exponential' ? sampler + ' Exponential' : sampler;

        const payload = {
            prompt: expandWildcards(body.prompt), negative_prompt: body.negative_prompt || '',
            width: body.width || 512, height: body.height || 768, steps: body.steps || 25,
            cfg_scale: body.cfg_scale || 7, sampler_name: samplerName, seed: body.seed ?? -1,
            batch_size: body.n || 1, restore_faces: body.face_restore || false, tiling: body.tiling || false
        };

        // Hires fix
        if (body.hires_fix) {
            payload.enable_hr = true;
            payload.hr_scale = body.hires_scale || 1.5;
            payload.hr_upscaler = body.hires_upscaler || 'Latent';
            payload.denoising_strength = body.denoising_strength || 0.7;
            payload.hr_second_pass_steps = body.hr_second_pass_steps || 0;
        }

        // ControlNet
        if (body.controlnet) {
            payload.alwayson_scripts = {
                controlnet: {
                    args: [{
                        enabled: true,
                        module: body.controlnet.preprocessor || 'none',
                        model: body.controlnet.model || 'control_v11p_sd15_canny',
                        weight: body.controlnet.weight || 1,
                        image: body.controlnet.image,
                        guidance_start: body.controlnet.guidance_start || 0,
                        guidance_end: body.controlnet.guidance_end || 1
                    }]
                }
            };
        }

        // IP-Adapter Face - extract facial features only from reference image
        if (body.ip_adapter) {
            payload.alwayson_scripts = payload.alwayson_scripts || {};
            payload.alwayson_scripts.controlnet = {
                args: [{
                    enabled: true,
                    module: "ip-adapter_face_id",
                    model: body.ip_adapter.model || "ip-adapter-faceid-portrait_sd15",
                    weight: body.ip_adapter.weight || 0.7,
                    image: body.ip_adapter.image,
                    resize_mode: "Crop and Resize",
                    control_mode: "Balanced",
                    pixel_perfect: true
                }]
            };
            log(sessionId, `IP-Adapter Face: model=${body.ip_adapter.model}, weight=${body.ip_adapter.weight}`);
        }

        // Regional prompting (via BREAK keyword)
        if (body.regional_prompts?.length) {
            payload.prompt = body.regional_prompts.map(r => r.prompt).join(' BREAK ');
        }

        // Img2Img
        if (body.init_image && !body.mask) {
            payload.init_images = [body.init_image];
            payload.denoising_strength = body.strength || 0.75;
            payload.resize_mode = body.resize_mode || 0;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }

        // Inpainting
        if (body.mask) {
            payload.init_images = [body.init_image];
            payload.mask = body.mask;
            payload.inpainting_fill = body.inpaint_fill ?? 1;
            payload.inpaint_full_res = body.inpaint_full_res ?? true;
            payload.inpaint_full_res_padding = body.inpaint_padding || 32;
            payload.denoising_strength = body.strength || 0.75;
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }

        // Outpainting
        if (body.outpaint) {
            payload.init_images = [body.init_image];
            payload.script_name = 'outpainting mk2';
            payload.script_args = [body.outpaint.pixels || 128, body.outpaint.direction || 'left,right,up,down'];
            const res = await fetch(`${url}/sdapi/v1/img2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        }

        // Track progress
        currentGeneration = { backend: 'local', startTime: Date.now() };
        const progressInterval = setInterval(async () => {
            try {
                const progRes = await fetch(`${url}/sdapi/v1/progress`);
                const prog = await progRes.json();
                sendProgress(sessionId, { type: 'generation', progress: prog.progress, eta: prog.eta_relative, preview: prog.current_image });
            } catch { /* progress poll — expected to fail between requests */ }
        }, 1000);

        try {
            const res = await fetch(`${url}/sdapi/v1/txt2img`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            return { data: (data.images || []).map(b64 => ({ b64_json: b64 })), info: data.info };
        } finally {
            clearInterval(progressInterval);
            currentGeneration = null;
            sendProgress(sessionId, { type: 'generation', progress: 1, done: true });
        }
    },

    async comfyui(body, headers, sessionId) {
        const url = headers['x-local-url'] || 'http://127.0.0.1:8188';

        // Sampler mapping
        const comfySamplerMap = {
            'euler_ancestral': 'euler_ancestral', 'euler_a': 'euler_ancestral', 'Euler a': 'euler_ancestral',
            'euler': 'euler', 'Euler': 'euler',
            'dpmpp_2m': 'dpmpp_2m', 'DPM++ 2M': 'dpmpp_2m', 'DPM++ 2M Karras': 'dpmpp_2m',
            'dpmpp_sde': 'dpmpp_sde', 'DPM++ SDE': 'dpmpp_sde', 'DPM++ SDE Karras': 'dpmpp_sde',
            'ddim': 'ddim', 'DDIM': 'ddim',
            'lms': 'lms', 'heun': 'heun', 'uni_pc': 'uni_pc'
        };
        const comfySchedulerMap = {
            'euler_ancestral': 'normal', 'euler_a': 'normal', 'Euler a': 'normal',
            'dpmpp_2m': 'karras', 'DPM++ 2M Karras': 'karras',
            'dpmpp_sde': 'karras', 'DPM++ SDE Karras': 'karras'
        };

        const seed = body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999999);
        const samplerName = comfySamplerMap[body.sampler] || 'euler_ancestral';
        const schedulerName = comfySchedulerMap[body.sampler] || 'normal';
        const denoise = body.denoise ?? 1.0;
        const clipSkip = body.clip_skip ?? 1;
        const model = body.model || 'model.safetensors';

        let workflow;

        // Check for custom workflow
        if (body.workflow) {
            workflow = typeof body.workflow === 'string' ? JSON.parse(body.workflow) : body.workflow;

            // Replace placeholders in workflow
            const replacements = {
                '%prompt%': body.prompt || '',
                '%negative%': body.negative_prompt || '',
                '%seed%': String(seed),
                '%width%': String(body.width || 512),
                '%height%': String(body.height || 768),
                '%steps%': String(body.steps || 25),
                '%cfg%': String(body.cfg_scale || 7),
                '%denoise%': String(denoise),
                '%clip_skip%': String(clipSkip),
                '%sampler%': samplerName,
                '%scheduler%': schedulerName,
                '%model%': model
            };

            const replaceInObj = (obj) => {
                for (const key in obj) {
                    if (typeof obj[key] === 'string') {
                        for (const [placeholder, value] of Object.entries(replacements)) {
                            obj[key] = obj[key].split(placeholder).join(value);
                        }
                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                        replaceInObj(obj[key]);
                    }
                }
            };
            replaceInObj(workflow);

            log(sessionId, `ComfyUI: Using custom workflow with ${Object.keys(workflow).length} nodes`);
        } else {
            // Default workflow
            workflow = {
                "3": {
                    class_type: "KSampler",
                    inputs: {
                        seed: seed,
                        steps: body.steps || 25,
                        cfg: body.cfg_scale || 7,
                        sampler_name: samplerName,
                        scheduler: schedulerName,
                        denoise: denoise,
                        model: ["4", 0],
                        positive: ["6", 0],
                        negative: ["7", 0],
                        latent_image: ["5", 0]
                    }
                },
                "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: model } },
                "5": { class_type: "EmptyLatentImage", inputs: { width: body.width || 512, height: body.height || 768, batch_size: 1 } },
                "6": { class_type: "CLIPTextEncode", inputs: { text: body.prompt || '', clip: clipSkip > 1 ? ["10", 0] : ["4", 1] } },
                "7": { class_type: "CLIPTextEncode", inputs: { text: body.negative_prompt || '', clip: clipSkip > 1 ? ["10", 0] : ["4", 1] } },
                "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
                "9": { class_type: "SaveImage", inputs: { filename_prefix: "sdproxy", images: ["8", 0] } }
            };

            if (clipSkip > 1) {
                workflow["10"] = { class_type: "CLIPSetLastLayer", inputs: { stop_at_clip_layer: -clipSkip, clip: ["4", 1] } };
            }

            log(sessionId, `ComfyUI: Using default workflow - sampler=${samplerName}, scheduler=${schedulerName}, steps=${body.steps || 25}, cfg=${body.cfg_scale || 7}, denoise=${denoise}, clip_skip=${clipSkip}`);
        }

        const queueRes = await fetch(`${url}/prompt`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: workflow })
        });
        const queueData = await queueRes.json();
        if (!queueData.prompt_id) throw new Error(queueData.error || 'Failed to queue workflow');

        log(sessionId, `ComfyUI: Queued as ${queueData.prompt_id}`);

        // Poll for completion
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const histRes = await fetch(`${url}/history/${queueData.prompt_id}`);
            const hist = await histRes.json();
            const result = hist[queueData.prompt_id];
            if (result?.outputs) {
                // Find any SaveImage/PreviewImage outputs
                const images = [];
                for (const nodeId in result.outputs) {
                    const output = result.outputs[nodeId];
                    if (output.images?.length) {
                        for (const img of output.images) {
                            images.push({ url: `${url}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || '')}&type=${img.type || 'output'}` });
                        }
                    }
                }
                if (images.length) {
                    log(sessionId, `ComfyUI: Got ${images.length} images`);
                    return { data: images };
                }
            }
        }
        throw new Error('Timeout waiting for ComfyUI');
    },

    async pollinations(body) {
        const seed = body.seed > 0 ? body.seed : Math.floor(Math.random() * 999999);
        const params = new URLSearchParams({ width: body.width || 512, height: body.height || 768, seed, nologo: 'true' });
        if (body.model) params.set('model', body.model);
        const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(body.prompt)}?${params}`;
        return { data: [{ url }] };
    },

    async nanogpt(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('NanoGPT requires API key');
        const res = await fetch('https://nano-gpt.com/api/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ prompt: body.prompt, model: body.model || 'flux-schnell', n: body.n || 1 })
        });
        return await res.json();
    },

    async novelai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('NovelAI requires API key');

        const nai = body.nai || {};
        const model = nai.model || 'nai-diffusion-4-5-curated';
        const params = {
            width: body.width || 832,
            height: body.height || 1216,
            n_samples: body.n || 1,
            seed: body.seed ?? Math.floor(Math.random() * 2147483647),
            sampler: nai.sampler || 'k_euler_ancestral',
            steps: nai.steps || 28,
            scale: nai.scale || 5,
            cfg_rescale: nai.cfg_rescale || 0,
            noise_schedule: nai.noise_schedule || 'native',
            uc_preset: nai.uc_preset ?? 0,
            uncond_scale: nai.uncond_scale || 1,
            negative_prompt: body.negative_prompt || '',
            sm: nai.smea || false,
            sm_dyn: nai.smea_dyn || false,
            decrisper: nai.decrisper || false,
            quality_toggle: nai.quality_toggle !== false,
            variety_plus: nai.variety_plus || false
        };

        log(sessionId, `NovelAI request: model=${model}, ${params.width}x${params.height}, steps=${params.steps}`);

        const res = await fetch('https://image.novelai.net/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                input: body.prompt,
                model: model,
                action: 'generate',
                parameters: params
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`NovelAI error ${res.status}: ${errText}`);
        }

        // NovelAI returns a zip file with PNG images
        const zipBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(zipBuffer);

        // Find PNG signatures in the zip
        const images = [];
        for (let i = 0; i < bytes.length - 8; i++) {
            if (bytes[i] === 0x89 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x4E && bytes[i + 3] === 0x47) {
                // Find PNG end
                let end = i + 8;
                while (end < bytes.length - 8) {
                    if (bytes[end] === 0x49 && bytes[end + 1] === 0x45 && bytes[end + 2] === 0x4E && bytes[end + 3] === 0x44) {
                        end += 8; // Include IEND chunk
                        break;
                    }
                    end++;
                }
                const pngData = bytes.slice(i, end);
                const b64 = Buffer.from(pngData).toString('base64');
                images.push({ b64_json: b64 });
                i = end - 1;
            }
        }

        log(sessionId, `NovelAI returned ${images.length} image(s)`);
        return { data: images };
    },

    async gemini(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Gemini requires API key');

        const opts = body.gemini || {};
        const model = opts.model || 'gemini-2.5-flash-image';

        // Build parts array with reference images and prompt
        const parts = [];
        if (body.reference_images?.length) {
            log(sessionId, `Adding ${body.reference_images.length} reference images`);
            for (const img of body.reference_images) {
                const match = img.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
                }
            }
        }
        parts.push({ text: body.prompt });

        log(sessionId, `Gemini request: model=${model}, prompt=${(body.prompt || '').substring(0, 50)}...`);

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    responseModalities: ['TEXT', 'IMAGE'],
                    ...(opts.aspect_ratio && { aspectRatio: opts.aspect_ratio })
                }
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const images = [];

        for (const candidate of data.candidates || []) {
            for (const part of candidate.content?.parts || []) {
                if (part.inlineData?.data) {
                    images.push({ b64_json: part.inlineData.data });
                }
            }
        }

        log(sessionId, `Gemini returned ${images.length} image(s)`);
        return { data: images };
    },

    async naistera(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Naistera requires API token');

        const opts = body.naistera || {};
        const n = body.n || 1;
        const varietyWords = ['', ', detailed', ', beautiful', ', stunning', ', elegant', ', graceful', ', vibrant', ', atmospheric'];

        // Limit prompt length to prevent timeouts (Naistera seems to struggle with very long prompts)
        const maxPromptLength = 500;
        let basePrompt = body.prompt;
        if (basePrompt.length > maxPromptLength) {
            basePrompt = basePrompt.substring(0, maxPromptLength).trim();
            log(sessionId, `Naistera prompt truncated to ${maxPromptLength} chars`);
        }

        // Generate all requests with staggered timing to avoid 409 errors
        const results = [];
        for (let i = 0; i < Math.min(n, 4); i++) {
            let variedPrompt = basePrompt;
            if (n > 1) {
                const variety = varietyWords[i % varietyWords.length];
                variedPrompt = basePrompt + variety;
            }

            const params = new URLSearchParams({ token: apiKey });
            if (opts.aspect_ratio) params.set('aspect_ratio', opts.aspect_ratio);
            if (opts.preset) params.set('preset', opts.preset);

            // Add aggressive cache-busting with random component
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2);
            params.set('_t', `${timestamp}_${i}_${random}`);
            params.set('_nocache', '1');

            const url = `https://naistera.org/prompt/${encodeURIComponent(variedPrompt)}?${params}`;
            log(sessionId, `Naistera request ${i + 1}: ${url.substring(0, 80)}...`);

            // Add delay between requests to avoid rate limiting (409 errors)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                log(sessionId, `Naistera: waited 2s before request ${i + 1}`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                log(sessionId, `Naistera request ${i + 1} timed out after 2 minutes`);
            }, 120000); // 2 minutes

            try {
                const res = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'User-Agent': `SDProxy-${timestamp}-${random}`
                    }
                });
                clearTimeout(timeoutId);

                if (!res.ok) {
                    if (res.status === 409) {
                        throw new Error(`Naistera rate limit (409) - try reducing batch size or waiting longer between requests`);
                    }
                    throw new Error(`Naistera error: ${res.status}`);
                }

                const buffer = await res.arrayBuffer();
                const b64 = Buffer.from(buffer).toString('base64');
                results.push({ b64_json: b64 });

                log(sessionId, `Naistera request ${i + 1} completed successfully`);
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error(`Naistera request ${i + 1} was aborted (timeout)`);
                }
                throw error;
            }
        }

        log(sessionId, `Naistera returned ${results.length} images`);
        return { data: results };
    },

    async civitai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('CivitAI requires API token');

        const opts = body.civitai || {};
        const input = {
            model: opts.model || 'urn:air:sd1:checkpoint:civitai:4201@130072',
            params: {
                prompt: body.prompt,
                negativePrompt: body.negative_prompt,
                scheduler: opts.scheduler || 'EulerA',
                steps: body.steps || 20,
                cfgScale: body.cfg_scale || 7,
                width: body.width || 512,
                height: body.height || 512,
                seed: body.seed || -1,
                clipSkip: opts.clipSkip || 2
            },
            batchSize: body.n || 1
        };

        if (opts.additionalNetworks) {
            input.additionalNetworks = opts.additionalNetworks;
        }

        log(sessionId, `CivitAI request: model=${input.model.split(':').pop()}, ${input.params.width}x${input.params.height}`);

        // Use CivitAI's actual generation endpoint
        const res = await fetch('https://civitai.com/api/v1/consumer/jobs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                $type: 'textToImage',
                input
            })
        });

        if (!res.ok) {
            const error = await res.text();
            throw new Error(`CivitAI error: ${res.status} - ${error}`);
        }

        const data = await res.json();
        const jobToken = data.token;
        if (!jobToken) throw new Error(`No job token returned. Response: ${JSON.stringify(data)}`);

        log(sessionId, `CivitAI job started: ${jobToken}`);

        // Poll for completion (10 minute timeout)
        let lastError = null;
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 5000)); // 5 second intervals

            const statusRes = await fetch(`https://civitai.com/api/v1/consumer/jobs?token=${jobToken}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!statusRes.ok) {
                lastError = `Status check failed: ${statusRes.status}`;
                log(sessionId, `CivitAI poll error: ${statusRes.status}`, 'warn');
                continue;
            }

            const jobs = await statusRes.json();
            const job = jobs?.[0];

            if (!job) {
                lastError = 'No job found in response';
                continue;
            }

            if (job.result?.blobUrl) {
                log(sessionId, `CivitAI completed: ${jobToken}`);
                return {
                    data: [{
                        url: job.result.blobUrl,
                        b64_json: null
                    }]
                };
            }

            if (job.scheduled === false && !job.result) {
                throw new Error(`CivitAI generation failed: ${job.message || 'Unknown error'}`);
            }
        }

        throw new Error(`CivitAI timeout (10 minutes). Last error: ${lastError || 'Still processing'}`);
    },

    async pixai(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('PixAI requires API key');

        const opts = body.pixai || {};
        const params = {
            prompts: body.prompt,
            modelId: opts.modelId || '1648918127446573124',
            width: body.width || 768,
            height: body.height || 1280,
            batchSize: Math.min(body.n || 1, 4)
        };

        // Core params
        if (body.negative_prompt) params.negativePrompts = body.negative_prompt;
        if (body.steps) params.samplingSteps = body.steps;
        if (body.cfg_scale) params.cfgScale = body.cfg_scale;
        if (body.seed) params.seed = body.seed;
        if (opts.sampler) params.samplingMethod = opts.sampler;

        // LoRAs
        if (body.loras?.length) {
            params.lora = {};
            body.loras.forEach(l => { params.lora[l.id] = l.weight || 0.7; });
        }

        // Quality boosters
        if (opts.enableADetailer) params.enableADetailer = true;
        if (opts.upscale > 1) {
            params.upscale = opts.upscale;
            if (opts.upscaleSampler) params.upscaleSampler = opts.upscaleSampler;
            if (opts.upscaleDenoisingStrength) params.upscaleDenoisingStrength = opts.upscaleDenoisingStrength;
            if (opts.upscaleDenoisingSteps) params.upscaleDenoisingSteps = opts.upscaleDenoisingSteps;
            if (opts.enableTile) params.enableTile = true;
        }

        // Img2Img
        if (opts.mediaUrl) {
            params.mediaUrl = opts.mediaUrl;
            if (opts.strength) params.strength = opts.strength;
        }

        // Prompt helper
        if (opts.promptHelper) params.promptHelper = { enable: true };

        log(sessionId, `PixAI request: model=${params.modelId}, ${params.width}x${params.height}, sampler=${params.samplingMethod || 'default'}`);

        const createRes = await fetch('https://api.pixai.art/v1/task', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ parameters: params })
        });
        const createData = await createRes.json();
        if (!createData.id) throw new Error(createData.message || 'Failed to create task');

        log(sessionId, `PixAI task created: ${createData.id}`);

        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.pixai.art/v1/task/${createData.id}`, { headers: { 'Authorization': `Bearer ${apiKey}` } });
            const task = await statusRes.json();
            if (task.status === 'completed' && task.outputs?.mediaUrls?.length) {
                log(sessionId, `PixAI completed: ${task.outputs.mediaUrls.length} images`);
                return { data: task.outputs.mediaUrls.filter(u => u).map(url => ({ url })) };
            }
            if (task.status === 'failed') throw new Error('Generation failed');
        }
        throw new Error('Timeout');
    },

    async stability(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Stability AI requires API key');
        const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                text_prompts: [{ text: body.prompt, weight: 1 }, { text: body.negative_prompt || '', weight: -1 }],
                cfg_scale: body.cfg_scale || 7, steps: body.steps || 30, width: body.width || 1024, height: body.height || 1024, samples: body.n || 1
            })
        });
        const data = await res.json();
        return { data: (data.artifacts || []).map(a => ({ b64_json: a.base64 })) };
    },

    async replicate(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Replicate requires API key');
        const res = await fetch('https://api.replicate.com/v1/predictions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${apiKey}` },
            body: JSON.stringify({
                version: body.model || 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
                input: { prompt: body.prompt, negative_prompt: body.negative_prompt, width: body.width || 1024, height: body.height || 1024, num_outputs: body.n || 1 }
            })
        });
        const pred = await res.json();
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { 'Authorization': `Token ${apiKey}` } });
            const status = await statusRes.json();
            if (status.status === 'succeeded') return { data: status.output.map(url => ({ url })) };
            if (status.status === 'failed') throw new Error(status.error || 'Failed');
        }
        throw new Error('Timeout');
    },

    async fal(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Fal.ai requires API key');
        const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${apiKey}` },
            body: JSON.stringify({ prompt: body.prompt, image_size: { width: body.width || 1024, height: body.height || 1024 }, num_images: body.n || 1 })
        });
        const data = await res.json();
        return { data: (data.images || []).map(img => ({ url: img.url })) };
    },

    async together(body, headers) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Together AI requires API key');
        const res = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: body.model || 'stabilityai/stable-diffusion-xl-base-1.0', prompt: body.prompt, negative_prompt: body.negative_prompt, width: body.width || 1024, height: body.height || 1024, n: body.n || 1, steps: body.steps || 20 })
        });
        return await res.json();
    },

    async kie(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Kie.ai requires API key');

        const opts = body.kie || {};
        const model = opts.model || body.model || 'google/nano-banana';

        // Build the input payload (varies by model but common fields)
        const input = { prompt: body.prompt };
        if (opts.aspect_ratio) input.aspect_ratio = opts.aspect_ratio;
        if (opts.resolution) input.resolution = opts.resolution;
        if (opts.output_format) input.output_format = opts.output_format;
        // For image-to-image models, upload base64 images to get hosted URLs
        if (body.reference_images?.length) {
            log(sessionId, `Uploading ${body.reference_images.length} reference images to Kie.ai`);
            const uploadedUrls = [];
            for (const img of body.reference_images) {
                const uploadRes = await fetch('https://kieai.redpandaai.co/api/file-base64-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ base64Data: img, uploadPath: 'images', fileName: `ref-${Date.now()}.png` })
                });
                const uploadData = await uploadRes.json();
                log(sessionId, `Kie.ai upload response: ${JSON.stringify(uploadData)}`);
                const url = uploadData.data?.fileUrl || uploadData.data?.downloadUrl || uploadData.data?.url || uploadData.fileUrl || uploadData.url;
                if (!url) {
                    throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
                }
                uploadedUrls.push(url);
                log(sessionId, `Uploaded reference image: ${url}`);
            }
            input.image_input = uploadedUrls;
        }
        // Pass through any extra input params the user sets
        if (opts.extra_input) Object.assign(input, opts.extra_input);

        const payload = { model, input };

        log(sessionId, `Kie.ai request: model=${model}`);

        // Create task
        const createRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify(payload)
        });
        const createData = await createRes.json();
        if (createData.code !== 200 || !createData.data?.taskId) {
            throw new Error(createData.msg || createData.message || 'Failed to create task');
        }

        const taskId = createData.data.taskId;
        log(sessionId, `Kie.ai task created: ${taskId}`);

        // Poll for results (up to ~5 minutes, every 3 seconds)
        for (let i = 0; i < 100; i++) {
            await new Promise(r => setTimeout(r, 3000));
            const statusRes = await fetch(
                `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
                { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            const status = await statusRes.json();
            const state = status.data?.state;

            log(sessionId, `Kie.ai task ${taskId}: ${state}`);

            if (state === 'success' && status.data?.resultJson) {
                const result = JSON.parse(status.data.resultJson);
                const urls = result.resultUrls || [];
                if (urls.length) {
                    log(sessionId, `Kie.ai completed: ${urls.length} images`);
                    return { data: urls.map(url => ({ url })) };
                }
                throw new Error('Task completed but no images returned');
            }
            if (state === 'fail') {
                throw new Error(status.data?.failMsg || 'Generation failed');
            }
            // Continue polling for: waiting, queuing, generating
        }
        throw new Error('Timeout waiting for Kie.ai task');
    },

    async midjourney(body, headers, sessionId) {
        const apiKey = headers.authorization?.replace('Bearer ', '');
        if (!apiKey) throw new Error('Midjourney requires LegNext API key');

        const opts = body.midjourney || {};
        const taskType = opts.taskType || 'imagine';
        const BASE = 'https://api.legnext.ai/api/v1';
        const authHeaders = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

        let jobId;

        if (taskType === 'imagine') {
            // Build prompt with MJ flags
            let text = body.prompt;
            if (opts.version) text += ` --v ${opts.version}`;
            if (opts.aspectRatio && opts.aspectRatio !== '1:1') text += ` --ar ${opts.aspectRatio}`;
            if (opts.stylization != null && +opts.stylization !== 100) text += ` --s ${opts.stylization}`;
            if (opts.weirdness != null && +opts.weirdness > 0) text += ` --w ${opts.weirdness}`;
            if (opts.variety != null && +opts.variety > 0) text += ` --variety ${opts.variety}`;
            if (opts.speed === 'turbo') text += ' --turbo';
            else if (opts.speed === 'relaxed') text += ' --relax';

            log(sessionId, `Midjourney imagine: ${text.substring(0, 100)}...`);
            const res = await fetch(`${BASE}/diffusion`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ text }) });
            const data = await res.json();
            log(sessionId, `Midjourney response: ${JSON.stringify(data).substring(0, 500)}`);
            if (data.error?.message || !data.job_id) throw new Error(data.error?.message || data.message || 'Failed to create task');
            jobId = data.job_id;
        } else if (taskType === 'blend' && body.reference_images?.length) {
            // Upload base64 images, then blend
            const imgUrls = [];
            for (const img of body.reference_images) {
                // LegNext expects hosted URLs — upload via data URI proxy or use directly if already URLs
                if (img.startsWith('http')) { imgUrls.push(img); continue; }
                // For base64, we need to find a hosting solution — for now pass as data URI
                imgUrls.push(img.startsWith('data:') ? img : `data:image/png;base64,${img}`);
            }
            const aspect_ratio = opts.aspectRatio === '16:9' ? '3:2' : opts.aspectRatio === '9:16' ? '2:3' : '1:1';
            const res = await fetch(`${BASE}/blend`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ imgUrls, aspect_ratio }) });
            const data = await res.json();
            if (data.error?.message || !data.job_id) throw new Error(data.error?.message || 'Failed to create blend task');
            jobId = data.job_id;
        } else if (taskType === 'upscale' && opts.parentTaskId) {
            const res = await fetch(`${BASE}/upscale`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ jobId: opts.parentTaskId, imageNo: opts.index || 0, type: 0 }) });
            const data = await res.json();
            if (data.error?.message || !data.job_id) throw new Error(data.error?.message || 'Failed to create upscale task');
            jobId = data.job_id;
        } else if (taskType === 'variation' && opts.parentTaskId) {
            const res = await fetch(`${BASE}/variation`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ jobId: opts.parentTaskId, imageNo: opts.index || 0, type: 1 }) });
            const data = await res.json();
            if (data.error?.message || !data.job_id) throw new Error(data.error?.message || 'Failed to create variation task');
            jobId = data.job_id;
        } else {
            throw new Error(`Unsupported task type: ${taskType}`);
        }

        log(sessionId, `Midjourney task created: ${jobId}`);

        // Poll for results (up to ~10 minutes, every 5 seconds)
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 5000));
            const statusRes = await fetch(`${BASE}/job/${jobId}`, { headers: { 'x-api-key': apiKey } });
            const status = await statusRes.json();
            const state = status.status;

            log(sessionId, `Midjourney task ${jobId}: ${state}`);
            sendProgress(sessionId, { type: 'generation', progress: state === 'processing' ? 0.5 : state === 'staged' ? 0.2 : 0.1 });

            if (state === 'completed') {
                const urls = status.output?.image_urls || (status.output?.image_url ? [status.output.image_url] : []);
                if (urls.length) {
                    log(sessionId, `Midjourney completed: ${urls.length} images`);
                    sendProgress(sessionId, { type: 'generation', progress: 1, done: true });
                    return { data: urls.map(url => ({ url })), jobId };
                }
                throw new Error('Task completed but no images returned');
            }
            if (state === 'failed') {
                throw new Error(status.error?.message || 'MJ generation failed');
            }
        }
        throw new Error('Timeout waiting for Midjourney task');
    },

    async custom(body, headers, sessionId) {
        let customUrl = headers['x-custom-url'];
        if (!customUrl) throw new Error('Custom URL required');
        const apiKey = headers.authorization?.replace('Bearer ', '');
        const reqHeaders = { 'Content-Type': 'application/json' };
        if (apiKey) reqHeaders['Authorization'] = `Bearer ${apiKey}`;

        const isImagesEndpoint = customUrl.includes('/images/generations');
        const isChatEndpoint = customUrl.includes('/chat/completions');
        if (!isImagesEndpoint && !isChatEndpoint) customUrl = customUrl.replace(/\/$/, '') + '/chat/completions';

        log(sessionId, `Custom backend request to: ${customUrl}`);

        if (isImagesEndpoint) {
            const payload = { prompt: body.prompt, n: body.n || 1, size: `${body.width || 1024}x${body.height || 1024}` };
            if (body.model) payload.model = body.model;
            const res = await fetch(customUrl, { method: 'POST', headers: reqHeaders, body: JSON.stringify(payload) });
            const data = await res.json();
            log(sessionId, `Custom backend response status: ${res.status}`);
            if (data.data?.length) return { data: data.data.map(img => ({ url: img.url, b64_json: img.b64_json })) };
            throw new Error(data.error?.message || JSON.stringify(data));
        }

        // Chat completions format
        const content = [];
        if (body.reference_images?.length) {
            log(sessionId, `Adding ${body.reference_images.length} reference images to request`);
            for (const img of body.reference_images) {
                content.push({ type: 'image_url', image_url: { url: img } });
            }
        }
        content.push({ type: 'text', text: body.prompt });

        const isGeminiImage = /gemini.*image|gemini.*preview/i.test(body.model);
        const payload = { model: body.model || 'gpt-4o', messages: [{ role: 'user', content }] };
        if (isGeminiImage) {
            payload.response_modalities = ['TEXT', 'IMAGE'];
            payload.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
            log(sessionId, `Gemini image model detected, adding responseModalities`);
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        const res = await fetch(customUrl, { method: 'POST', headers: reqHeaders, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        log(sessionId, `Custom backend response status: ${res.status}`);
        if (!res.ok) throw new Error(data.error?.message || data.error || JSON.stringify(data));
        const msg = data.choices?.[0]?.message || {};
        if (msg.images?.length) { log(sessionId, `Found ${msg.images.length} images in response`); return { data: msg.images.map(img => ({ url: img.image_url?.url || img.url })) }; }
        const msgContent = msg.content || '';
        const urls = msgContent.match(/https?:\/\/[^\s\)]+\.(png|jpg|jpeg|webp|gif)/gi) || [];
        if (urls.length) { log(sessionId, `Found ${urls.length} image URLs in content`); return { data: urls.map(url => ({ url })) }; }
        throw new Error(msgContent || JSON.stringify(data));
    }
};

// Upscale endpoint (A1111)
app.post('/api/upscale', async (req, res) => {
    try {
        const { image, scale, upscaler } = req.body;
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/extra-single-image`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, upscaling_resize: scale || 2, upscaler_1: upscaler || 'R-ESRGAN 4x+' })
        });
        const data = await response.json();
        res.json({ image: data.image });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Interrogate/Caption image (BLIP/CLIP)
app.post('/api/interrogate', async (req, res) => {
    try {
        const { image, model } = req.body;
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/interrogate`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image, model: model || 'clip' })
        });
        const data = await response.json();
        res.json({ caption: data.caption });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get A1111 progress
app.get('/api/a1111/progress', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const response = await fetch(`${url}/sdapi/v1/progress`);
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Interrupt generation
app.post('/api/interrupt', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        await fetch(`${url}/sdapi/v1/interrupt`, { method: 'POST' });
        currentGeneration = null;
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get available models from A1111
app.get('/api/a1111/models', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const [models, vaes, loras, embeddings] = await Promise.all([
            fetch(`${url}/sdapi/v1/sd-models`).then(r => r.json()),
            fetch(`${url}/sdapi/v1/sd-vae`).then(r => r.json()).catch(() => []),
            fetch(`${url}/sdapi/v1/loras`).then(r => r.json()).catch(() => []),
            fetch(`${url}/sdapi/v1/embeddings`).then(r => r.json()).catch(() => ({}))
        ]);
        res.json({ models, vaes, loras, embeddings: Object.keys(embeddings.loaded || {}) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Switch model in A1111
app.post('/api/a1111/model', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const { model, vae } = req.body;
        const options = {};
        if (model) options.sd_model_checkpoint = model;
        if (vae) options.sd_vae = vae;
        await fetch(`${url}/sdapi/v1/options`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(options)
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ControlNet preprocessors
app.post('/api/controlnet/preprocess', async (req, res) => {
    try {
        const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        const { image, module } = req.body;
        const response = await fetch(`${url}/controlnet/detect`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ controlnet_input_images: [image], controlnet_module: module || 'canny' })
        });
        const data = await response.json();
        res.json({ images: data.images });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Download model from Civitai
app.post('/api/civitai/download', async (req, res) => {
    try {
        const { url: modelUrl, filename } = req.body;
        const sessionId = req.headers['x-session-id'];
        const localUrl = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
        if (!/^https?:\/\//i.test(String(modelUrl || ''))) {
            throw new Error('Invalid model URL');
        }

        // Get model path from A1111
        const optRes = await fetch(`${localUrl}/sdapi/v1/options`);
        const options = await optRes.json();
        const modelDir = options.outdir_samples?.replace('/outputs', '/models/Stable-diffusion') || path.join(MODELS_DIR, 'checkpoints');

        fs.mkdirSync(modelDir, { recursive: true });
        const safeName = safeFilename(filename, `model-${Date.now()}.safetensors`);
        const filePath = path.join(modelDir, safeName);
        const response = await fetch(modelUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);
        if (!response.body) throw new Error('Download stream unavailable');
        const fileStream = fs.createWriteStream(filePath);

        const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
        let downloaded = 0;

        response.body.on('data', chunk => {
            downloaded += chunk.length;
            if (totalSize > 0) {
                sendProgress(sessionId, { type: 'download', progress: downloaded / totalSize, filename: safeName });
            }
        });

        await new Promise((resolve, reject) => {
            response.body.pipe(fileStream);
            response.body.on('error', reject);
            fileStream.on('error', reject);
            fileStream.on('finish', resolve);
        });

        res.json({ success: true, path: filePath });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Prompt enhancement via LLM
app.post('/api/enhance-prompt', async (req, res) => {
    try {
        const { prompt, style } = req.body;
        const apiKey = req.headers.authorization?.replace('Bearer ', '');

        // Use Pollinations text API (free)
        const enhancePrompt = `Enhance this image generation prompt with more details and artistic descriptions. Keep it concise (under 200 words). Style: ${style || 'detailed'}. Original: "${prompt}"`;
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(enhancePrompt)}`);
        const enhanced = await response.text();
        res.json({ enhanced: enhanced.trim() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// X/Y/Z Plot generation
app.post('/api/xyz-plot', async (req, res) => {
    try {
        const { baseParams, xAxis, yAxis, zAxis } = req.body;
        const sessionId = req.headers['x-session-id'];
        const results = [];
        const xValues = xAxis?.values || [''];
        const yValues = yAxis?.values || [''];
        const zValues = zAxis?.values || [''];

        for (const z of zValues) {
            for (const y of yValues) {
                for (const x of xValues) {
                    const params = { ...baseParams };
                    if (xAxis?.param) params[xAxis.param] = x;
                    if (yAxis?.param) params[yAxis.param] = y;
                    if (zAxis?.param) params[zAxis.param] = z;

                    sendProgress(sessionId, { type: 'xyz', x, y, z, status: 'generating' });
                    const handler = backends[params.backend || 'local'];
                    if (!handler) throw new Error('Unknown backend: ' + (params.backend || 'local'));
                    const result = await handler(params, req.headers, sessionId);
                    results.push({ x, y, z, images: result.data });
                }
            }
        }
        res.json({ results, grid: { x: xValues, y: yValues, z: zValues } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Batch from file
app.post('/api/batch-file', async (req, res) => {
    try {
        const { prompts, baseParams } = req.body;
        const sessionId = req.headers['x-session-id'];
        const results = [];
        for (let i = 0; i < prompts.length; i++) {
            sendProgress(sessionId, { type: 'batch', current: i + 1, total: prompts.length });
            const params = { ...baseParams, prompt: prompts[i] };
            const handler = backends[params.backend || 'local'];
            if (!handler) throw new Error('Unknown backend: ' + (params.backend || 'local'));
            const result = await handler(params, req.headers, sessionId);
            results.push({ prompt: prompts[i], images: result.data });
        }
        res.json({ results });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Templates endpoints removed - now in localStorage

// Main generation endpoint
app.post('/v1/images/generations', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    try {
        const backend = req.headers['x-backend'] || 'local';
        log(sessionId, `Generation request: backend=${backend}, model=${req.body.model || 'default'}`);
        log(sessionId, `Prompt: ${(req.body.prompt || '').substring(0, 100)}...`);
        if (req.body.reference_images?.length) log(sessionId, `Reference images: ${req.body.reference_images.length}`);

        const handler = backends[backend];
        if (!handler) throw new Error('Unknown backend: ' + backend);
        const result = await handler(req.body, req.headers, sessionId);

        log(sessionId, `Generation complete: ${result.data?.length || 0} images`);

        res.json(result);
    } catch (e) { log(sessionId, `Generation error: ${e.message}`, 'error'); res.status(500).json({ error: e.message }); }
});

// Proxy endpoint for A1111 ControlNet models
app.get('/api/proxy/controlnet/model_list', async (req, res) => {
    const url = req.headers['x-local-url'] || 'http://127.0.0.1:7860';
    try {
        const proxyRes = await fetch(`${url}/controlnet/model_list`);
        if (!proxyRes.ok) throw new Error(`A1111 error ${proxyRes.status}`);
        const data = await proxyRes.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message, model_list: [] });
    }
});

// Queue endpoints
app.get('/api/queue', (req, res) => res.json(queue));
app.post('/api/queue', (req, res) => { queue.push({ id: Date.now() + Math.floor(Math.random() * 1000), ...req.body }); res.json({ success: true, length: queue.length }); });
app.delete('/api/queue/:id', (req, res) => { queue = queue.filter(q => String(q.id) !== req.params.id); res.json({ success: true }); });
app.post('/api/queue/process', async (req, res) => {
    if (!queue.length) return res.json({ message: 'Queue empty' });
    const sessionId = req.headers['x-session-id'];
    const results = [];
    while (queue.length) {
        const item = queue.shift();
        try {
            const handler = backends[item.backend || 'local'];
            if (!handler) throw new Error('Unknown backend: ' + (item.backend || 'local'));
            const result = await handler(item, req.headers, sessionId);
            results.push({ id: item.id, success: true, data: result.data });
        } catch (e) { results.push({ id: item.id, success: false, error: e.message }); }
    }
    res.json(results);
});

// History, favorites, folders, presets, costs endpoints removed - now in localStorage

// PNG metadata extraction
app.post('/api/metadata', (req, res) => {
    try {
        const { image } = req.body;
        const buffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        // Simple PNG tEXt chunk extraction
        let params = {};
        const pngSig = buffer.slice(0, 8);
        let offset = 8;
        while (offset < buffer.length) {
            const len = buffer.readUInt32BE(offset);
            const type = buffer.slice(offset + 4, offset + 8).toString('ascii');
            if (type === 'tEXt' || type === 'iTXt') {
                const data = buffer.slice(offset + 8, offset + 8 + len).toString('utf8');
                const [key, ...val] = data.split('\0');
                if (key === 'parameters' || key === 'prompt') params.raw = val.join('');
            }
            offset += 12 + len;
            if (type === 'IEND') break;
        }
        res.json(params);
    } catch (e) { res.json({ error: e.message }); }
});

// Proxy for external APIs
app.get('/proxy/models', async (req, res) => {
    const { url, key } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
        const headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = `Bearer ${key}`;
        const response = await fetch(url, { headers });
        res.json(await response.json());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Models list
app.get('/v1/models', (req, res) => res.json({ data: Object.keys(backends).map(id => ({ id, name: id })) }));

// Chat completions (for compatibility)
app.post('/v1/chat/completions', async (req, res) => {
    const lastMsg = req.body.messages?.[req.body.messages.length - 1]?.content || '';
    try {
        const backend = req.headers['x-backend'] || 'pollinations';
        const result = await backends[backend]({ prompt: lastMsg, n: 1 }, req.headers);
        const imageUrl = result.data?.[0]?.url || result.data?.[0]?.b64_json;
        res.json({ choices: [{ message: { role: 'assistant', content: imageUrl ? `![Image](${imageUrl})` : 'Failed' } }] });
    } catch (e) { res.json({ choices: [{ message: { role: 'assistant', content: 'Error: ' + e.message } }] }); }
});

// Self-update endpoints
app.get('/api/update/check', requireAuth, (req, res) => {
    try {
        const cwd = __dirname;
        execSync('git fetch origin', { cwd, timeout: 15000 });
        const local = execSync('git rev-parse HEAD', { cwd }).toString().trim();
        const remote = execSync('git rev-parse origin/main', { cwd }).toString().trim();
        const behind = +execSync('git rev-list --count HEAD..origin/main', { cwd }).toString().trim();
        let version = 'unknown';
        try { version = require('./package.json').version; } catch {}
        const shortHash = local.slice(0, 7);
        let changelog = '';
        if (behind > 0) {
            changelog = execSync('git log --oneline HEAD..origin/main', { cwd }).toString().trim();
        }
        res.json({ version, hash: shortHash, behind, changelog, upToDate: behind === 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/update/apply', requireAuth, (req, res) => {
    try {
        const cwd = __dirname;
        const output = execSync('git pull origin main', { cwd, timeout: 30000 }).toString();
        res.json({ success: true, output });
        setTimeout(() => { process.exit(0); }, 1000);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`SD Proxy running on http://localhost:${PORT}`));

// Increase timeout for large image generations
server.timeout = 300000; // 5 minutes
server.keepAliveTimeout = 300000;
server.headersTimeout = 300000;
