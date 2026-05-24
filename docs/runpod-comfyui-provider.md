# RunPod & ComfyUI Providers Architecture

This document describes the design and integration of the serverless AI providers in BT Studio AI Workspace V0.4.

---

## 1. Overview & Provider Interface

All AI tool integrations in BT Studio are built around a modular, adapter-based design. Every provider implements a standardized interface defined in `backend/src/modules/ai-tools/providers/provider.types.ts`:

```typescript
export interface AIProviderInput {
  toolSlug: string;
  params: Record<string, unknown>;
  jobId: string;
}

export interface AIProviderResult {
  fileUrl?: string;       // Publicly accessible URL of the generated asset
  outputData?: Record<string, unknown>; // Detailed provider payload
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  errorMsg?: string;
  providerJobId?: string; // Async job identifier from the third-party service
}

export interface AIProvider {
  invoke(input: AIProviderInput): Promise<AIProviderResult>;
  poll?(providerJobId: string, toolSlug: string): Promise<AIProviderResult>;
}
```

The lookup factory `provider.factory.ts` loads the requested provider dynamically:
* `mock`: A zero-dependency local simulation generating Unsplash placeholders.
* `runpod`: Executes models hosted on serverless RunPod endpoints.
* `comfyui`: Drives a ComfyUI workflow via prompt APIs.

---

## 2. RunPod Serverless Integration (`runpod.provider.ts`)

RunPod provides serverless computing resources ideal for scaling custom Stable Diffusion or ComfyUI containers.

### Job Invocation (`/run`)
When invoked, the RunPod adapter targets the serverless asynchronous execution API:
```http
POST https://api.runpod.ai/v1/{{RUNPOD_ENDPOINT_ID}}/run
Authorization: Bearer {{RUNPOD_API_KEY}}
Content-Type: application/json

{
  "input": {
    "tool": "image-generation",
    "params": { ... },
    "jobId": "job_1234"
  }
}
```
* If the job completes instantly (e.g., cached or simple request), it returns a `COMPLETED` status.
* Typically, it returns a `200 OK` with an async job ID (`id`), transitioning the pipeline state to `PENDING` with `providerJobId` set.

### Polling Loop (`/status`)
For async runs, the background BullMQ worker queries the status endpoint:
```http
GET https://api.runpod.ai/v1/{{RUNPOD_ENDPOINT_ID}}/status/{{providerJobId}}
Authorization: Bearer {{RUNPOD_API_KEY}}
```

**Status Mapping:**
* `COMPLETED`: Extracts the final image URL from `res.data.output`. If `output` is an object, it searches for `fileUrl` or `url` fields.
* `FAILED` / `CANCELLED`: Marks the internal AIJob as `FAILED` and logs the API error reason.
* `IN_QUEUE` / `IN_PROGRESS`: Stays in `PENDING` state to be polled again on the next tick.

---

## 3. ComfyUI API Integration (`comfyui.provider.ts`)

ComfyUI allows running complex nodal workflows (upscaling, inpainting, face restoration, background removal) via programmatic HTTP interfaces.

### Dynamic Workflow Resolution
The ComfyUI adapter selects a workflow template based on the tool requested:
1. **Upscale**: Reads `COMFYUI_DEFAULT_WORKFLOW_UPSCALE`.
2. **Edit/Inpaint**: Reads `COMFYUI_DEFAULT_WORKFLOW_IMAGE_EDIT`.
3. **Generate**: Reads `COMFYUI_DEFAULT_WORKFLOW_IMAGE_GENERATION`.

If no workspace environment templates are declared, the adapter falls back to a **predefined minimalist text-to-image JSON workflow** (including a standard KSampler, CheckpointLoaderSimple, CLIPTextEncode, EmptyLatentImage, VAEDecode, and SaveImage nodes).

### Workflow Customization
The adapter parses the raw JSON string and dynamically injects parameter overrides, e.g.:
```javascript
// Dynamically replace prompt text in node "6" (CLIPTextEncode)
if (workflow["6"]?.inputs?.text !== undefined) {
  workflow["6"].inputs.text = input.params.prompt || "cyberpunk visual art";
}
```

### Submitting prompt (`/prompt`)
The customized workflow is submitted directly to the ComfyUI server:
```http
POST {{COMFYUI_BASE_URL}}/prompt
Content-Type: application/json

{
  "prompt": { ...workflowJSON... },
  "client_id": "bt_{{jobId}}"
}
```
ComfyUI enqueues the workflow and returns a unique `prompt_id`.

### Polling History (`/history`)
ComfyUI does not expose a straightforward "active status" endpoint. Instead, the provider polls the `/history/{{prompt_id}}` endpoint:
```http
GET {{COMFYUI_BASE_URL}}/history/{{prompt_id}}
```
* If the history object does not yet contain the `prompt_id` key, the workflow is still enqueued or executing (`PENDING`).
* When the key appears, the run is complete. The adapter scans the execution output node-by-node to extract the saved image output filename:
```javascript
const outputs = history.outputs;
let filename = '';
let subfolder = '';

for (const nodeId of Object.keys(outputs)) {
  const nodeOutput = outputs[nodeId];
  if (nodeOutput.images && nodeOutput.images.length > 0) {
    filename = nodeOutput.images[0].filename;
    subfolder = nodeOutput.images[0].subfolder || '';
    break;
  }
}
```

### Retrieving Output Image (`/view`)
To fetch the compiled file, the adapter generates a static lookup URL pointing to the `/view` endpoint of the ComfyUI instance:
```
{{COMFYUI_BASE_URL}}/view?filename={{filename}}&subfolder={{subfolder}}&type=output
```
This temporary URL is returned to the background processor, which downloads the image and saves it securely into the primary S3 / Local storage.

---

## 4. Graceful Mock Fallbacks
To allow friction-free development and smoke testing:
* If `RUNPOD_API_KEY` or `RUNPOD_ENDPOINT_ID` are missing, the RunPod provider logs a warning and gracefully outputs high-quality placeholder image links (`mockFallback: true`) so that the application never crashes.
* Similarly, if `COMFYUI_BASE_URL` is omitted, the ComfyUI provider automatically cascades to beautiful mock outputs.
