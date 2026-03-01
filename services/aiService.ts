// services/aiService.ts
import { TimeEntry, AppSettings, ScanResult, AIProvider } from "../types";

// --- Helpers ---

const resolveModelAlias = (provider: AIProvider, model: string): string => {
  if (model !== 'auto') return model;
  switch (provider) {
    case 'gemini': return 'gemini-3-flash-preview';
    case 'openai': return 'gpt-4o-mini';
    case 'claude': return 'claude-3-5-sonnet-latest';
    case 'mistral': return 'pixtral-12b-2409';
    case 'groq': return 'llama-3.2-90b-vision-preview';
    case 'qwen': return 'qwen-vl-max';
    case 'openrouter': return 'meta-llama/llama-3.2-90b-vision-instruct';
    default: return model;
  }
};

const mapToTimeEntries = (data: any[]): TimeEntry[] => {
  return data.map((item: any, index: number) => ({
    id: `entry-${Date.now()}-${index}`,
    ...item,
  }));
};

const parseJsonArrayFromText = (text: string): TimeEntry[] => {
  try {
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstOpen = cleanText.indexOf("[");
    const lastClose = cleanText.lastIndexOf("]");
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      const potentialJson = cleanText.substring(firstOpen, lastClose + 1);
      const data = JSON.parse(potentialJson);
      if (Array.isArray(data)) return mapToTimeEntries(data);
    }

    if (cleanText.trim().startsWith("{")) {
      try {
        const singleObj = JSON.parse(`[${cleanText}]`);
        return mapToTimeEntries(singleObj);
      } catch {}
    }

    return [];
  } catch {
    return [];
  }
};

const parseJsonObjectFromText = (text: string): any => {
  try {
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const firstOpen = cleanText.indexOf("{");
    const lastClose = cleanText.lastIndexOf("}");
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      const potentialJson = cleanText.substring(firstOpen, lastClose + 1);
      return JSON.parse(potentialJson);
    }

    return JSON.parse(cleanText);
  } catch {
    return {};
  }
};

const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      } else {
        resolve(base64Str.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, ""));
      }
    };

    img.onerror = () => {
      resolve(base64Str.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, ""));
    };
  });
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs = 25000): Promise<Response> => {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Try again (or increase timeout).");
    }
    throw e;
  } finally {
    window.clearTimeout(t);
  }
};

// ✅ MISSING BEFORE: used all over the file
const safeJson = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// --- Providers ---

const geminiGenerateContentREST = async (opts: {
  apiKey: string;
  model: string;
  parts: any[];
  generationConfig?: any;
  timeoutMs?: number;
  debug?: boolean;
}) => {
  const { apiKey, model, parts, generationConfig, timeoutMs = 30000, debug = false } = opts;

  const k = (apiKey || "").trim();
  if (!k) throw new Error("Missing Gemini API Key.");

  // normalize parts to REST format
  const normalizedParts = (parts || []).map((p) => {
    if (!p) return p;

    // SDK-style -> REST-style
    if (p.inlineData) {
      return { inline_data: { mime_type: p.inlineData.mimeType, data: p.inlineData.data } };
    }

    // Already REST
    if (p.inline_data) return p;

    if (typeof p.text === "string") return { text: p.text };
    return p;
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;


  const body = {
    contents: [{ role: "user", parts: normalizedParts }],
    ...(generationConfig ? { generationConfig } : {}),
  };

  if (debug) console.debug("[Gemini] Request:", url, body);

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": k, // ✅ consistent everywhere
      },
      body: JSON.stringify(body),
    },
    timeoutMs
  );

  const j = await safeJson(res);

  if (debug) console.debug("[Gemini] Response:", res.status, j);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const msg = j?.error?.message || `Gemini Error: ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  const candidates = j?.candidates || [];
  if (!candidates.length) {
    const fb = j?.promptFeedback ? JSON.stringify(j.promptFeedback) : "";
    throw new Error(`Gemini returned no candidates. promptFeedback=${fb}`);
  }

  const text =
    candidates?.[0]?.content?.parts?.map((pp: any) => pp.text).filter(Boolean).join("") || "";

  if (!text) {
    const finish = candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned empty content. finishReason=${finish || "unknown"}`);
  }

  return text;
};

const callOpenAI = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing OpenAI API Key.");

  if (debug) console.debug("[OpenAI] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an OCR assistant. Return only valid JSON array." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[OpenAI] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[OpenAI] Error Body:", err);
    throw new Error(`OpenAI Error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[OpenAI] Success Body:", data);
  return data.choices?.[0]?.message?.content || "";
};

const callMistral = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing Mistral API Key.");

  if (debug) console.debug("[Mistral] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: `data:image/jpeg;base64,${base64}` },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[Mistral] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[Mistral] Error Body:", err);
    throw new Error(`Mistral Error: ${err?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[Mistral] Success Body:", data);
  return data.choices?.[0]?.message?.content || "";
};

const callClaude = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing Claude API Key.");

  if (debug) console.debug("[Claude] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": k,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "dangerously-allow-browser": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
              { type: "text", text: prompt + "\nReturn ONLY valid JSON." },
            ],
          },
        ],
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[Claude] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[Claude] Error Body:", err);
    throw new Error(`Claude Error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[Claude] Success Body:", data);
  return data.content?.[0]?.text || "";
};

const callGroq = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing Groq API Key.");

  if (debug) console.debug("[Groq] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an OCR assistant. Return only valid JSON array." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[Groq] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[Groq] Error Body:", err);
    throw new Error(`Groq Error: ${err?.error?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[Groq] Success Body:", data);
  return data.choices?.[0]?.message?.content || "";
};

const callQwen = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing Qwen API Key.");

  if (debug) console.debug("[Qwen] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an OCR assistant. Return only valid JSON array." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[Qwen] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[Qwen] Error Body:", err);
    throw new Error(`Qwen Error: ${err?.error?.message || err?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[Qwen] Success Body:", data);
  return data.choices?.[0]?.message?.content || "";
};

const callOpenRouter = async (base64: string, prompt: string, key: string, model: string, timeoutMs = 90000, debug = false) => {
  const k = (key || "").trim();
  if (!k) throw new Error("Missing OpenRouter API Key.");

  if (debug) console.debug("[OpenRouter] Request:", { model, promptLength: prompt.length });

  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${k}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "TimeSnap"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are an OCR assistant. Return only valid JSON array." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
      }),
    },
    timeoutMs
  );

  if (debug) console.debug("[OpenRouter] Response Status:", res.status);

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`The selected model (${model}) is no longer supported by the provider. Please select a different model in Settings.`);
    }
    const err = await safeJson(res);
    if (debug) console.debug("[OpenRouter] Error Body:", err);
    throw new Error(`OpenRouter Error: ${err?.error?.message || err?.message || res.statusText}`);
  }

  const data = await res.json();
  if (debug) console.debug("[OpenRouter] Success Body:", data);
  return data.choices?.[0]?.message?.content || "";
};

// --- Verification ---

export const verifyApiKey = async (provider: AIProvider, key: string, model?: string, debug = false): Promise<boolean> => {
  const k = (key || "").trim();
  if (!k) return false;

  const resolvedModel = resolveModelAlias(provider, model || 'auto');

  if (debug) console.debug(`[Verify] Checking ${provider} with model ${resolvedModel}...`);

  try {
    if (provider === "gemini") {
      // ✅ verify by calling generateContent, not by requiring non-empty text
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent` +
        `?_ts=${Date.now()}`;

      if (debug) console.debug("[Verify Gemini] Request:", url);

      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": k,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ping" }] }],
            generationConfig: { maxOutputTokens: 16 },
          }),
        },
        15000
      );

      if (debug) console.debug("[Verify Gemini] Response:", res.status);

      if (res.status === 429) return true;
      if (!res.ok) {
        const err = await safeJson(res);
        if (debug) console.warn("Gemini Verify Failed:", res.status, res.statusText, err);
      }
      return res.ok;
    }

    if (provider === "openai") {
      if (debug) console.debug("[Verify OpenAI] Requesting...");
      const res = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${k}` },
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        },
        15000
      );
      if (debug) console.debug("[Verify OpenAI] Response:", res.status);

      if (res.status === 429) return true;
      if (!res.ok) {
        const err = await safeJson(res);
        if (debug) console.warn("OpenAI Verify Failed:", res.status, err);
      }
      return res.ok;
    }

    if (provider === "mistral" || provider === "groq" || provider === "qwen" || provider === "openrouter") {
      const urlMap: Record<string, string> = {
        mistral: "https://api.mistral.ai/v1/chat/completions",
        groq: "https://api.groq.com/openai/v1/chat/completions",
        qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        openrouter: "https://openrouter.ai/api/v1/chat/completions"
      };
      
      const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${k}` };
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = window.location.href;
        headers["X-Title"] = "TimeSnap";
      }

      if (debug) console.debug(`[Verify ${provider}] Requesting...`);
      const res = await fetchWithTimeout(
        urlMap[provider],
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: resolvedModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        },
        15000
      );
      if (debug) console.debug(`[Verify ${provider}] Response:`, res.status);

      if (res.status === 429) return true;
      if (!res.ok) {
        const err = await safeJson(res);
        if (debug) console.warn(`${provider} Verify Failed:`, res.status, err);
      }
      return res.ok;
    }

    if (provider === "claude") {
      if (debug) console.debug("[Verify Claude] Requesting...");
      const res = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": k,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "dangerously-allow-browser": "true",
          },
          body: JSON.stringify({
            model: resolvedModel,
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }],
          }),
        },
        15000
      );
      if (debug) console.debug("[Verify Claude] Response:", res.status);

      if (res.status === 429) return true;
      if (!res.ok) {
        const err = await safeJson(res);
        if (debug) console.warn("Claude Verify Failed:", res.status, err);
      }
      return res.ok;
    }

    return false;
  } catch (e) {
    if (debug) console.error("verifyApiKey failed:", e);
    return false;
  }
};

// --- Main Scan ---

export const extractTimeDataFromImage = async (
  base64Image: string,
  onProgress: (status: string) => void,
  settings: AppSettings
): Promise<ScanResult> => {
  const { activeProvider, activeModel } = settings;
  const resolvedModel = resolveModelAlias(activeProvider, activeModel);

  let apiKey = "";
  switch (activeProvider) {
    case "openai":
      apiKey = settings.openaiApiKey;
      break;
    case "claude":
      apiKey = settings.claudeApiKey;
      break;
    case "mistral":
      apiKey = settings.mistralApiKey;
      break;
    case "groq":
      apiKey = settings.groqApiKey;
      break;
    case "qwen":
      apiKey = settings.qwenApiKey;
      break;
    case "openrouter":
      apiKey = settings.openrouterApiKey;
      break;
    case "gemini":
    default:
      apiKey = settings.geminiApiKey;
      break;
  }

  if (!apiKey) throw new Error(`Missing API Key for ${activeProvider.toUpperCase()}.`);

  onProgress("Preparing image...");
  const cleanBase64 = await compressImage(base64Image);

  const fullPrompt = `
${settings.aiSystemPrompt}

Current Year Context: ${settings.defaultYear}
Expected JSON Structure Keys: ${settings.aiOutputSchema}
`.trim();

  let rawText = "";

  try {
    if (activeProvider === "openai") {
      onProgress(`Connecting to OpenAI (${resolvedModel})...`);
      rawText = await callOpenAI(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else if (activeProvider === "mistral") {
      onProgress(`Connecting to Mistral (${resolvedModel})...`);
      rawText = await callMistral(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else if (activeProvider === "groq") {
      onProgress(`Connecting to Groq (${resolvedModel})...`);
      rawText = await callGroq(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else if (activeProvider === "qwen") {
      onProgress(`Connecting to Qwen (${resolvedModel})...`);
      rawText = await callQwen(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else if (activeProvider === "openrouter") {
      onProgress(`Connecting to OpenRouter (${resolvedModel})...`);
      rawText = await callOpenRouter(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else if (activeProvider === "claude") {
      onProgress(`Connecting to Claude (${resolvedModel})...`);
      rawText = await callClaude(cleanBase64, fullPrompt, apiKey, resolvedModel, 90000, settings.debugMode);
    } else {
      onProgress("Connecting to Gemini...");

      // Build schema
      const props: any = {};
      const required: string[] = [];
      try {
        const userSchema = JSON.parse(settings.aiOutputSchema);
        Object.keys(userSchema).forEach((field) => {
          props[field] = { type: "STRING" };
          required.push(field);
        });
      } catch {
        props.date = { type: "STRING" };
        props.entrance = { type: "STRING" };
        props.exit = { type: "STRING" };
        required.push("date", "entrance", "exit");
      }

      rawText = await geminiGenerateContentREST({
        apiKey,
        model: resolvedModel,
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
          { text: fullPrompt },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: {
            type: "ARRAY",
            items: { type: "OBJECT", properties: props, required },
          },
          maxOutputTokens: 8192,
        },
        timeoutMs: 90000,
        debug: settings.debugMode,
      });
    }
  } catch (e: any) {
    if (settings.debugMode) console.error("AI Service Error:", e);
    throw e;
  }

  onProgress("Parsing results...");
  const entries = rawText ? parseJsonArrayFromText(rawText) : [];

  return {
    entries,
    rawResponse: rawText || "",
    debugMeta: { provider: activeProvider, model: activeModel },
  };
};

// --- Excel Mapping (restored) ---

export const suggestColumnMapping = async (
  previews: Record<string, any[][]>,
  dataSample: TimeEntry,
  settings: AppSettings
): Promise<{ targetSheet?: string; headerRow?: number; mapping: Record<string, string> }> => {
  const { activeProvider, activeModel } = settings;
  const resolvedModel = resolveModelAlias(activeProvider, activeModel);

  let apiKey = "";
  switch (activeProvider) {
    case "openai":
      apiKey = settings.openaiApiKey;
      break;
    case "claude":
      apiKey = settings.claudeApiKey;
      break;
    case "mistral":
      apiKey = settings.mistralApiKey;
      break;
    case "groq":
      apiKey = settings.groqApiKey;
      break;
    case "qwen":
      apiKey = settings.qwenApiKey;
      break;
    case "openrouter":
      apiKey = settings.openrouterApiKey;
      break;
    case "gemini":
    default:
      apiKey = settings.geminiApiKey;
      break;
  }

  if (!apiKey) throw new Error(`Missing API Key for ${activeProvider.toUpperCase()}.`);

  const prompt = `
${settings.aiMappingPrompt}

EXCEL FILE PREVIEW (First 20 rows of each sheet):
${JSON.stringify(previews)}

DATA KEYS TO MAP:
${JSON.stringify(Object.keys(dataSample))}
Return ONLY JSON.
`.trim();

  let rawText = "";

  if (activeProvider === "openai") {
    const r = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: resolvedModel,
          messages: [
            { role: "system", content: "You are an Excel analyzer. Return valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
      25000
    );

    if (settings.debugMode) console.debug("[Mapping OpenAI] Response:", r.status);

    if (!r.ok) throw new Error((await safeJson(r))?.error?.message || r.statusText);
    const j = await r.json();
    rawText = j.choices?.[0]?.message?.content || "";
  } else if (activeProvider === "mistral" || activeProvider === "groq" || activeProvider === "qwen" || activeProvider === "openrouter") {
    const urlMap: Record<string, string> = {
      mistral: "https://api.mistral.ai/v1/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      qwen: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      openrouter: "https://openrouter.ai/api/v1/chat/completions"
    };
    
    const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    if (activeProvider === "openrouter") {
      headers["HTTP-Referer"] = window.location.href;
      headers["X-Title"] = "TimeSnap";
    }

    const body: any = {
      model: resolvedModel,
      messages: [{ role: "user", content: prompt }],
    };
    if (activeProvider === "mistral" || activeProvider === "groq") {
      body.response_format = { type: "json_object" };
    }

    const r = await fetchWithTimeout(
      urlMap[activeProvider],
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      25000
    );

    if (settings.debugMode) console.debug(`[Mapping ${activeProvider}] Response:`, r.status);

    if (!r.ok) throw new Error((await safeJson(r))?.message || r.statusText);
    const j = await r.json();
    rawText = j.choices?.[0]?.message?.content || "";
  } else if (activeProvider === "claude") {
    const r = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "dangerously-allow-browser": "true",
        },
        body: JSON.stringify({
          model: resolvedModel,
          max_tokens: 8192,
          messages: [{ role: "user", content: prompt }],
        }),
      },
      25000
    );

    if (settings.debugMode) console.debug("[Mapping Claude] Response:", r.status);

    if (!r.ok) throw new Error((await safeJson(r))?.error?.message || r.statusText);
    const j = await r.json();
    rawText = j.content?.[0]?.text || "";
  } else {
    rawText = await geminiGenerateContentREST({
      apiKey,
      model: resolvedModel,
      parts: [{ text: prompt }],
      generationConfig: {
        response_mime_type: "application/json",
        maxOutputTokens: 8192,
      },
      timeoutMs: 25000,
      debug: settings.debugMode,
    });
  }

  const parsed = parseJsonObjectFromText(rawText || "{}");

  if (parsed && typeof parsed === "object") {
    // Handle the structured response from the new prompt
    if (parsed.mapping || parsed.targetSheet || parsed.headerRow) {
      return {
        targetSheet: parsed.targetSheet,
        headerRow: parsed.headerRow,
        mapping: parsed.mapping || {},
      };
    }
    // Fallback for older/simpler responses
    return { mapping: parsed as Record<string, string> };
  }

  return { mapping: {} };
};
