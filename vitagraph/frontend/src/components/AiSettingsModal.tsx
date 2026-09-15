import { useEffect, useState } from "react";
import { aiApi, type AiConfig, type AiConfigUpdatePayload } from "../api/ai";

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: AiConfig | null;
  onConfigUpdated: (newConfig: AiConfig) => void;
  onLogDetailed?: (msg: string, type?: "tool" | "py" | "db" | "llm" | "ok" | "warn" | "info") => void;
}

const PROVIDER_PRESETS: Record<
  string,
  { name: string; url: string; defaultModel: string; badge: string; keyHint: string; helpUrl: string }
> = {
  gemini: {
    name: "Google Gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-1.5-flash",
    badge: "Recommended • Generous Free Tier",
    keyHint: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    badge: "Industry Standard",
    keyHint: "sk-proj-...",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  groq: {
    name: "Groq Cloud",
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    badge: "Ultra-Fast Inference",
    keyHint: "gsk_...",
    helpUrl: "https://console.groq.com/keys",
  },
  openrouter: {
    name: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "deepseek/deepseek-chat",
    badge: "Multi-Model Router",
    keyHint: "sk-or-v1-...",
    helpUrl: "https://openrouter.ai/keys",
  },
  custom: {
    name: "Custom OpenAI-Compatible",
    url: "",
    defaultModel: "custom-model",
    badge: "Self-Hosted / Local LLM",
    keyHint: "sk-...",
    helpUrl: "",
  },
};

export function AiSettingsModal({
  isOpen,
  onClose,
  currentConfig,
  onConfigUpdated,
  onLogDetailed,
}: AiSettingsModalProps) {
  const [provider, setProvider] = useState<string>("gemini");
  const [apiKey, setApiKey] = useState<string>("");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [model, setModel] = useState<string>("gemini-1.5-flash");
  const [url, setUrl] = useState<string>(PROVIDER_PRESETS.gemini.url);
  const [allowApi, setAllowApi] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setProvider(currentConfig.provider || "gemini");
      setModel(currentConfig.model || "gemini-1.5-flash");
      setUrl(currentConfig.url || PROVIDER_PRESETS.gemini.url);
      setAllowApi(currentConfig.allow_api);
    }
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleProviderChange = (p: string) => {
    setProvider(p);
    const preset = PROVIDER_PRESETS[p];
    if (preset) {
      if (p !== "custom") {
        setUrl(preset.url);
        setModel(preset.defaultModel);
      }
    }
    setFeedback(null);
  };

  const handleSaveAndTest = async () => {
    setIsTesting(true);
    setFeedback(null);

    const payload: AiConfigUpdatePayload = {
      provider,
      api_key: apiKey.trim(),
      model: model.trim(),
      url: url.trim(),
      allow_api: allowApi,
    };

    try {
      if (onLogDetailed) {
        onLogDetailed(`[AI Service] Testing connection to ${provider} (${model})...`, "llm");
      }

      const res = await aiApi.setConfig(payload);
      onConfigUpdated(res);

      if (res.status === "connected") {
        setFeedback({
          type: "success",
          message: res.message || `✓ Connected to ${model} successfully!`,
        });
        if (onLogDetailed) {
          onLogDetailed(`[AI Service] ✓ Connected to ${model} (${res.masked_key})`, "ok");
        }
      } else {
        setFeedback({
          type: "error",
          message: res.message || "Connection failed. Please verify API key and model name.",
        });
        if (onLogDetailed) {
          onLogDetailed(`[AI Service] ✕ Connection error: ${res.message}`, "warn");
        }
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: (err as Error).message || "Failed to reach VitaGraph backend.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const currentPreset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS.custom;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[28px] border-2 border-slate-200 shadow-2xl max-w-[620px] w-full p-6 md:p-8 overflow-hidden relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 border-2 border-violet-200 flex items-center justify-center text-2xl text-violet-700 font-bold">
              ✦
            </div>
            <div>
              <h2 className="jakarta text-[20px] font-bold text-slate-900">
                AI API Key & Model Settings
              </h2>
              <p className="text-[12px] text-slate-500">
                Connect your LLM provider to power conversational health synthesis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Provider Selection */}
          <div>
            <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select AI Provider
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleProviderChange(key)}
                  className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                    provider === key
                      ? "border-violet-600 bg-violet-50/70 text-violet-950 font-bold shadow-xs"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                  }`}
                >
                  <div className="text-[13px] font-bold leading-tight">{p.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 truncate">{p.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">
                API Key
              </label>
              {currentPreset.helpUrl && (
                <a
                  href={currentPreset.helpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline font-semibold"
                >
                  Get {currentPreset.name} API Key ↗
                </a>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  currentConfig?.masked_key
                    ? `Current: ${currentConfig.masked_key} (leave blank to keep)`
                    : `Paste ${currentPreset.name} key (${currentPreset.keyHint})`
                }
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 text-[13px] bg-slate-50 font-mono text-slate-800 outline-none focus:border-violet-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 hover:text-slate-600 font-bold"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>

            {currentConfig?.has_api_key && !apiKey && (
              <p className="text-[11px] text-emerald-700 mt-1 font-medium flex items-center gap-1.5">
                <span>●</span> Active key stored: <span className="font-mono">{currentConfig.masked_key}</span>
              </p>
            )}
          </div>

          {/* Model Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Model Identifier
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. gemini-1.5-flash"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 text-[13px] bg-slate-50 font-mono text-slate-800 outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                AI Service Mode
              </label>
              <button
                type="button"
                onClick={() => setAllowApi(!allowApi)}
                className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-[13px] font-bold flex items-center justify-between cursor-pointer transition ${
                  allowApi
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-amber-400 bg-amber-50 text-amber-900"
                }`}
              >
                <span>{allowApi ? "● Online (External AI API)" : "○ Offline (Local Core)"}</span>
                <span className="text-[11px] underline">Toggle</span>
              </button>
            </div>
          </div>

          {/* Custom Endpoint URL if custom */}
          {provider === "custom" && (
            <div>
              <label className="block text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                OpenAI-Compatible Chat Completions URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-server.com/v1/chat/completions"
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 text-[13px] bg-slate-50 font-mono text-slate-800 outline-none focus:border-violet-500"
              />
            </div>
          )}

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border-2 text-[12px] font-medium animate-in fade-in duration-150 ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                  : "bg-red-50 border-red-300 text-red-900"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Privacy Box */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-[11px] text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800">🔒 VitaGraph Privacy Contract: </span>
            Raw PDF files are never uploaded to the LLM. Only retrieved evidence snippets
            specifically matching your query are sent to the AI API. Full user-id isolation is enforced.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border-2 border-slate-200 text-[13px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveAndTest}
            disabled={isTesting}
            className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-bold transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Testing connection...
              </>
            ) : (
              <>✦ Test & Save AI Key</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
