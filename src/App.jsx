import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  MessageSquare, 
  ShieldAlert, 
  Settings, 
  Cpu, 
  Terminal, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  UserCheck
} from 'lucide-react';

export default function App() {
  // Debate Control States
  const [topic, setTopic] = useState("Should artificial general intelligence (AGI) development be fully open-sourced?");
  const [agentAProfile, setAgentAProfile] = useState("Silicon Valley Techno-Optimist");
  const [agentBProfile, setAgentBProfile] = useState("Global Catastrophic Risk Analyst");
  const [rounds, setRounds] = useState(3);

  // Streaming & Orchestration States
  const [isRunning, setIsRunning] = useState(false);
  const [statusText, setStatusText] = useState("Engine Idle. Ready to synthesize.");
  const [currentRound, setCurrentRound] = useState(1);
  const [currentTurn, setCurrentTurn] = useState(null); // 'A', 'B', 'JUDGE'
  const [streamedText, setStreamedText] = useState("");
  const [debateHistory, setDebateHistory] = useState([]);
  const [judgeVerdict, setJudgeVerdict] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Backend base URL — set VITE_API_URL in your Vercel/Netlify env vars
  // (and in a local .env file for development). Falls back to localhost
  // only so local dev keeps working without extra setup.
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const agentAStreamRef = useRef(null);
  const agentBStreamRef = useRef(null);
  const judgeStreamRef = useRef(null);

  // Auto Scroll dynamic stream containers to bottom during generation
  useEffect(() => {
    if (currentTurn === 'A' && agentAStreamRef.current) {
      agentAStreamRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (currentTurn === 'B' && agentBStreamRef.current) {
      agentBStreamRef.current.scrollIntoView({ behavior: 'smooth' });
    } else if (currentTurn === 'JUDGE' && judgeStreamRef.current) {
      judgeStreamRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamedText, currentTurn, judgeVerdict]);

  // Connect to the FastAPI SSE backend streaming interface
  const startDebateEngine = async () => {
    setIsRunning(true);
    setDebateHistory([]);
    setJudgeVerdict("");
    setErrorMessage("");
    setCurrentRound(1);
    setCurrentTurn(null);
    setStatusText("Establishing persistent stream connection...");

    try {
      const response = await fetch(`${API_URL}/api/debate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          agent_a_profile: agentAProfile,
          agent_b_profile: agentBProfile,
          rounds: Number(rounds)
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP Error Status: ${response.status}`);
      }

      // Initialize reader on response body stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Retain incomplete line

        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine.startsWith("data: ")) {
            const data = JSON.parse(cleanLine.slice(6));

            switch (data.event) {
              case "status":
                setStatusText(data.message);
                break;
              case "stream_start":
                setCurrentTurn(data.agent);
                setCurrentRound(data.round);
                setStreamedText("");
                break;
              case "stream_chunk":
                setStreamedText(prev => prev + data.text);
                break;
              case "stream_end":
                setDebateHistory(prev => [...prev, {
                  round: data.round,
                  agent: data.agent,
                  text: data.full_text
                }]);
                setStreamedText("");
                break;
              case "judge_start":
                setCurrentTurn('JUDGE');
                setStatusText("Supreme Court is reviewing transcript parameters...");
                setJudgeVerdict("");
                break;
              case "judge_chunk":
                setJudgeVerdict(prev => prev + data.text);
                break;
              case "complete":
                setStatusText("Debate has concluded. Supreme Decision filed.");
                setIsRunning(false);
                setCurrentTurn(null);
                break;
              case "error":
                setErrorMessage(data.message);
                setStatusText("Execution Terminated.");
                setIsRunning(false);
                setCurrentTurn(null);
                break;
              default:
                break;
            }
          }
        }
      }
    } catch (err) {
      setErrorMessage(`Network error connecting to API at ${API_URL}: ${err.message}. Check that the backend is running and VITE_API_URL is set correctly.`);
      setStatusText("Connection Fault.");
      setIsRunning(false);
    }
  };

  // Helper utility to parse simple Markdown in the UI securely without external libraries
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("# ")) {
        return <h1 key={idx} className="text-2xl md:text-3xl font-black text-amber-400 mt-6 mb-4 border-b border-amber-500/20 pb-2 tracking-tight">{line.replace("# ", "")}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={idx} className="text-lg md:text-xl font-bold text-slate-100 mt-5 mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" />{line.replace("## ", "")}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={idx} className="text-md md:text-lg font-semibold text-slate-200 mt-4 mb-2">{line.replace("### ", "")}</h3>;
      }
      if (line.startsWith("* ") || line.startsWith("- ")) {
        const cleanLine = line.replace(/^[\*\-]\s+/, "");
        const parts = cleanLine.split("**");
        return (
          <li key={idx} className="ml-5 list-disc text-slate-300 text-sm mb-2 leading-relaxed">
            {parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-amber-300 font-medium">{p}</strong> : p)}
          </li>
        );
      }
      if (line.startsWith("|")) {
        if (line.includes("---")) return null;
        const columns = line.split("|").map(col => col.trim()).filter(col => col !== "");
        return (
          <div key={idx} className="grid grid-cols-3 bg-slate-900/50 border border-slate-800 text-xs md:text-sm p-3 rounded-lg my-1">
            {columns.map((c, colIdx) => (
              <div key={colIdx} className={`${colIdx === 0 ? "font-semibold text-slate-200" : "text-center text-slate-300"}`}>
                {c.replace(/\*\*/g, "")}
              </div>
            ))}
          </div>
        );
      }
      if (line.trim() === "") return <div key={idx} className="h-2"></div>;
      
      const parts = line.split("**");
      return (
        <p key={idx} className="text-slate-300 text-sm md:text-base leading-relaxed mb-4">
          {parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="text-amber-400 font-semibold">{p}</strong> : p)}
        </p>
      );
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* HEADER CONTROLS */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2 rounded-xl border border-cyan-400/20">
              <Cpu className="w-6 h-6 text-cyan-100" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                AEGIS <span className="text-xs uppercase px-2 py-0.5 rounded-md bg-cyan-950 border border-cyan-800 text-cyan-400">COGNITIVE DEBATE PLATFORM</span>
              </h1>
              <p className="text-xs text-slate-400">Multi-Agent State Machine & Live SSE Streaming Client</p>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <div className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5 text-cyan-500" /> API: {API_URL}</div>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">

        {/* CONTROLS & MONITOR */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Topic Inputs */}
            <div className="lg:col-span-6 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Debate Thesis</label>
              <textarea
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isRunning}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm focus:outline-none text-slate-100 transition-all resize-none"
                placeholder="Formulate a debate statement..."
              />
            </div>

            {/* Persona A */}
            <div className="lg:col-span-3 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent A (PRO)</label>
              <input
                type="text"
                value={agentAProfile}
                onChange={(e) => setAgentAProfile(e.target.value)}
                disabled={isRunning}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm focus:outline-none text-slate-100 transition-all"
                placeholder="Persona configuration..."
              />
            </div>

            {/* Persona B */}
            <div className="lg:col-span-3 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent B (CON)</label>
              <input
                type="text"
                value={agentBProfile}
                onChange={(e) => setAgentBProfile(e.target.value)}
                disabled={isRunning}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-sm focus:outline-none text-slate-100 transition-all"
                placeholder="Persona configuration..."
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-850 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className={`flex h-3 w-3 relative ${isRunning ? "block" : "hidden"}`}>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wide">Live Monitor Status</p>
                <p className="text-sm font-semibold text-slate-300">{statusText}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Rounds:</span>
                <select
                  value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                  disabled={isRunning}
                  className="bg-slate-950 border border-slate-800 rounded-lg text-xs px-3 py-1.5 focus:outline-none focus:border-cyan-500 text-slate-300"
                >
                  <option value={1}>1 Round</option>
                  <option value={2}>2 Rounds</option>
                  <option value={3}>3 Rounds</option>
                  <option value={4}>4 Rounds</option>
                </select>
              </div>

              <button
                onClick={startDebateEngine}
                disabled={isRunning}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg ${
                  isRunning
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-indigo-500 text-slate-950 hover:from-cyan-400 hover:to-indigo-400 active:scale-95"
                }`}
              >
                <Play className="w-4.5 h-4.5 fill-current" />
                Initialize Match
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-4 bg-rose-950/30 border border-rose-900/30 rounded-xl flex items-start gap-3 text-xs text-rose-300 animate-fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Execution Error</h4>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* DEBATE COGNITIVE ARENA COLS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT CHAMBER - AGENT A */}
          <div className="flex flex-col bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden min-h-[420px]">
            <div className="bg-gradient-to-r from-cyan-950/20 to-slate-900/50 border-b border-slate-850 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-950 border border-cyan-800 text-cyan-400 text-xs px-2.5 py-1 rounded-md font-bold">PRO</div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Agent Alpha</h4>
                  <p className="text-[10px] text-cyan-400">{agentAProfile}</p>
                </div>
              </div>
              {currentTurn === 'A' && (
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold bg-cyan-950/50 border border-cyan-500/20 px-3 py-1 rounded-full animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Live Stream
                </div>
              )}
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto max-h-[460px]">
              {debateHistory
                .filter(h => h.agent === 'A')
                .map((h, idx) => (
                  <div key={idx} className="space-y-2 border-b border-slate-800/25 pb-4 last:border-b-0">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Round {h.round} Submission</span>
                      <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">Statement</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{h.text}</p>
                  </div>
                ))}

              {currentTurn === 'A' && (
                <div className="space-y-2 bg-cyan-950/10 border border-cyan-900/20 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-cyan-400">Synthesizing Turn {currentRound}...</span>
                  <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">{streamedText || "Computing parameters..."}</p>
                  <div ref={agentAStreamRef} />
                </div>
              )}

              {debateHistory.filter(h => h.agent === 'A').length === 0 && currentTurn !== 'A' && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <MessageSquare className="w-10 h-10 text-slate-800 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Waiting for first argument matrix</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT CHAMBER - AGENT B */}
          <div className="flex flex-col bg-slate-900/20 border border-slate-900 rounded-3xl overflow-hidden min-h-[420px]">
            <div className="bg-gradient-to-r from-rose-950/20 to-slate-900/50 border-b border-slate-850 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-rose-950 border border-rose-900 text-rose-400 text-xs px-2.5 py-1 rounded-md font-bold">CON</div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">Agent Beta</h4>
                  <p className="text-[10px] text-rose-400">{agentBProfile}</p>
                </div>
              </div>
              {currentTurn === 'B' && (
                <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold bg-rose-950/50 border border-rose-500/20 px-3 py-1 rounded-full animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Live Stream
                </div>
              )}
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto max-h-[460px]">
              {debateHistory
                .filter(h => h.agent === 'B')
                .map((h, idx) => (
                  <div key={idx} className="space-y-2 border-b border-slate-800/25 pb-4 last:border-b-0">
                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      <span>Round {h.round} Submission</span>
                      <span className="bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">Rebuttal</span>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{h.text}</p>
                  </div>
                ))}

              {currentTurn === 'B' && (
                <div className="space-y-2 bg-rose-950/10 border border-rose-900/20 p-4 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-rose-400">Synthesizing Turn {currentRound}...</span>
                  <p className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap">{streamedText || "Computing parameters..."}</p>
                  <div ref={agentBStreamRef} />
                </div>
              )}

              {debateHistory.filter(h => h.agent === 'B').length === 0 && currentTurn !== 'B' && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <MessageSquare className="w-10 h-10 text-slate-800 mb-2" />
                  <p className="text-xs font-semibold text-slate-600">Waiting for first argument matrix</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM JUDGE WORKSPACE */}
        <div className="bg-slate-900/30 border border-slate-900 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-950/20 to-slate-900/50 border-b border-slate-850 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-950 border border-amber-900 text-amber-400 p-2 rounded-xl">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-100 text-base">SUPREME DECISION OFFICE</h3>
                <p className="text-xs text-slate-400">Holistic Judicial Metric Analysis & Structural Scoreboards</p>
              </div>
            </div>

            {currentTurn === 'JUDGE' && (
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold bg-amber-950/50 border border-amber-500/20 px-4 py-1.5 rounded-lg animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Reviewing Transcript System Data...
              </div>
            )}
          </div>

          <div className="p-6 md:p-8 min-h-[220px]">
            {judgeVerdict ? (
              <div className="prose prose-invert max-w-none">
                {renderMarkdown(judgeVerdict)}
                <div ref={judgeStreamRef} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
                <Terminal className="w-10 h-10 text-slate-800 mb-3" />
                <h4 className="text-sm font-semibold text-slate-400">Waiting for Match Completion</h4>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Upon completion of all debate rounds, the supreme judge agent will automatically assess, evaluate, and stream the final verdict here.
                </p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600 bg-slate-950">
        <p>© 2026 Aegis Engine Core. Designed as an asynchronous, multi-agent event framework.</p>
      </footer>
    </div>
  );
}
