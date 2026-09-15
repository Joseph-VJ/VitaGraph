import { useState, useRef, useEffect } from "react";
import type { Answer, EvidenceCard as EvidenceType } from "../types";

export interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  evidence?: EvidenceType[];
  status?: string;
  modelUsed?: string;
  limitationsText?: string;
  safetyText?: string;
}

interface AiChatAssistantProps {
  activePersonaId: string;
  activePersonaName: string;
  aiServiceModel: string | null;
  hasApiKey: boolean;
  onRunQuery: (question: string) => Promise<void> | void;
  isSearching: boolean;
  liveAnswer: Answer | null;
  onOpenAiSettings: () => void;
  activeConcepts?: string[];
}

export function AiChatAssistant({
  activePersonaId,
  activePersonaName,
  aiServiceModel,
  hasApiKey,
  onRunQuery,
  isSearching,
  liveAnswer,
  onOpenAiSettings,
  activeConcepts = [],
}: AiChatAssistantProps) {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "ai",
      text: `Hello ${activePersonaName}! I am your VitaGraph AI Lab Assistant.\n\nI have read and indexed your lab reports using 384-dimensional MiniLM embeddings in your private ChromaDB store.\n\nAsk me any question about your test results, biomarker reference ranges, or historical health trends. Every answer is grounded directly in your uploaded pages with verifiable citations.`,
      timestamp: "Just now",
      modelUsed: aiServiceModel || "Local RAG Core",
    },
  ]);
  const [selectedCitation, setSelectedCitation] = useState<EvidenceType | null>(null);
  const [showTechnicalProof, setShowTechnicalProof] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync new live answer when received
  useEffect(() => {
    if (liveAnswer) {
      setMessages((prev) => {
        // Prevent duplicate append
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.sender === "ai" && lastMsg.id === liveAnswer.question_id) {
          return prev;
        }

        const newAiMsg: ChatMessage = {
          id: liveAnswer.question_id,
          sender: "ai",
          text: liveAnswer.summary_text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          evidence: liveAnswer.evidence,
          status: liveAnswer.status,
          modelUsed:
            liveAnswer.ai_service_status === "ok"
              ? aiServiceModel || "Live AI Model"
              : "VitaGraph Local Clinical Composer",
          limitationsText: liveAnswer.limitations_text,
          safetyText: liveAnswer.safety_text,
        };
        return [...prev, newAiMsg];
      });
    }
  }, [liveAnswer, aiServiceModel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSearching]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSearching) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    onRunQuery(text);
  };

  const handleSelectPrompt = (prompt: string) => {
    handleSendMessage(prompt);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg_reset_${Date.now()}`,
        sender: "ai",
        text: `Conversation history cleared. Ready for your next question about ${activePersonaName}'s reports.`,
        timestamp: "Just now",
        modelUsed: aiServiceModel || "Local RAG Core",
      },
    ]);
    setSelectedCitation(null);
  };

  return (
    <div className="flex flex-col h-full min-h-[660px] max-w-[940px] mx-auto">
      {/* Top AI Chat Header */}
      <div className="bg-linear-to-r from-violet-900 to-indigo-900 text-white rounded-2xl p-5 mb-4 shadow-sm border border-violet-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl text-violet-200">
              ✦
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-[18px] text-white">
                  VitaGraph AI Clinical Assistant
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    hasApiKey
                      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
                      : "bg-amber-500/20 border-amber-400/40 text-amber-300"
                  }`}
                >
                  {hasApiKey ? `● Live AI: ${aiServiceModel || "Configured"}` : "○ Offline Local Mode"}
                </span>
              </div>
              <p className="text-[12px] text-white/70 mt-0.5">
                Privacy-isolated RAG • Grounded exclusively in {activePersonaName}&apos;s documents ({activePersonaId})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenAiSettings}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Configure AI API Key (Gemini, OpenAI, Groq)"
            >
              <span>⚙️</span>
              <span>AI API Key</span>
            </button>
            <button
              onClick={handleClearChat}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/80 text-[12px] font-medium transition cursor-pointer"
              title="Clear conversation"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="mb-4">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Suggested AI Prompts (Click to Ask Live RAG)
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {[
            "What does my hemoglobin trend show across my reports?",
            "Was my Vitamin D level low in any of my visits?",
            "What was my Fasting Blood Sugar and HbA1c in December 2025?",
            "What do my reports say about LDL and Total Cholesterol?",
            "Do I have diabetes based on my glucose? Please diagnose me.",
          ].map((promptText, idx) => (
            <button
              key={idx}
              disabled={isSearching}
              onClick={() => handleSelectPrompt(promptText)}
              className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 text-[12px] font-medium text-slate-700 whitespace-nowrap transition cursor-pointer disabled:opacity-50 shrink-0 shadow-2xs"
            >
              💬 {promptText}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 min-h-[380px] max-h-[500px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {/* AI Avatar */}
            {msg.sender === "ai" && (
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-[14px] shrink-0 shadow-xs">
                ✦
              </div>
            )}

            {/* Message Bubble */}
            <div
              className={`rounded-2xl p-4 max-w-[85%] md:max-w-[78%] transition shadow-xs ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-tr-xs"
                  : "bg-white border-2 border-slate-200 text-slate-900 rounded-tl-xs"
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-black/5">
                <span
                  className={`text-[11px] font-bold ${
                    msg.sender === "user" ? "text-blue-100" : "text-violet-700"
                  }`}
                >
                  {msg.sender === "user" ? activePersonaName : msg.modelUsed || "VitaGraph AI"}
                </span>
                <span
                  className={`text-[10px] ${
                    msg.sender === "user" ? "text-blue-200" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Message Content */}
              <div className="text-[14px] leading-relaxed whitespace-pre-line font-normal">
                {msg.text}
              </div>

              {/* Citations Chips */}
              {msg.evidence && msg.evidence.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <span>📚 Verifiable Report Citations:</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Click to inspect source quote)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.evidence.map((ev, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setSelectedCitation(
                            selectedCitation?.chunk_id === ev.chunk_id ? null : ev
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer flex items-center gap-1 ${
                          selectedCitation?.chunk_id === ev.chunk_id
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        <span>📄</span>
                        <span className="font-semibold">{ev.report_filename}</span>
                        <span className="text-slate-400">p.{ev.page_number}</span>
                        <span
                          className={`ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                            ev.score >= 0.6
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {Math.round(ev.score * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Limitations & Safety Disclaimers */}
              {msg.limitationsText && (
                <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2 leading-tight">
                  <span className="font-bold text-slate-700">What cannot be concluded: </span>
                  {msg.limitationsText}
                </div>
              )}
            </div>

            {/* User Avatar */}
            {msg.sender === "user" && (
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-[13px] shrink-0 shadow-xs">
                👤
              </div>
            )}
          </div>
        ))}

        {/* AI Typing / Thinking State */}
        {isSearching && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-200">
            <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-[14px] shrink-0 shadow-xs animate-pulse">
              ✦
            </div>
            <div className="bg-white border-2 border-violet-200 rounded-2xl rounded-tl-xs p-4 text-slate-800 shadow-xs flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-bounce [animation-delay:0.3s]" />
              </div>
              <span className="text-[13px] font-medium text-violet-900">
                VitaGraph AI is querying Chroma vector index & synthesizing answer with {aiServiceModel || "AI API"}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Citation Drawer */}
      {selectedCitation && (
        <div className="mb-3 bg-violet-50/80 border-2 border-violet-200 rounded-2xl p-4 animate-in slide-in-from-bottom-2 duration-150 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-violet-700 font-bold text-[13px]">
                🔍 Citation Provenance Preview: {selectedCitation.report_filename} (Page {selectedCitation.page_number})
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-200 text-violet-900 font-bold">
                Cosine Match: {Math.round(selectedCitation.score * 100)}%
              </span>
            </div>
            <button
              onClick={() => setSelectedCitation(null)}
              className="text-[12px] text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕ Close
            </button>
          </div>
          <div className="text-[12px] font-mono bg-white p-3 rounded-xl border border-violet-100 text-slate-800 leading-relaxed max-h-[100px] overflow-y-auto">
            &quot;{selectedCitation.snippet}&quot;
          </div>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-2.5 shadow-sm focus-within:border-violet-500 transition">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSearching}
            placeholder="Ask VitaGraph AI anything about your reports (e.g. 'What was my hemoglobin level?')..."
            className="flex-1 px-4 py-2.5 text-[14px] bg-transparent text-slate-900 placeholder-slate-400 outline-none font-medium"
          />
          <button
            type="submit"
            disabled={isSearching || !inputText.trim()}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-[13px] transition cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
          >
            <span>Ask AI</span>
            <span>→</span>
          </button>
        </form>
      </div>

      {/* Technical Toggle Button */}
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => setShowTechnicalProof(!showTechnicalProof)}
          className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold"
        >
          {showTechnicalProof ? "▲ Hide Technical Vector Data" : "▼ Show Technical Proof & Chroma Vectors"}
        </button>

        {showTechnicalProof && (
          <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-[11px] font-mono text-slate-600">
            <div>User Scope: {activePersonaId} • Threshold: ≥ 0.40 score</div>
            <div>Active Graph Concepts: {activeConcepts.join(", ") || "None"}</div>
            <div>Model: {aiServiceModel || "Local composer"} • API Key configured: {hasApiKey ? "Yes" : "No"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
