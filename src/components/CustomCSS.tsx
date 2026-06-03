import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { Code, Play, RotateCcw, Copy, Check } from "lucide-react";

export default function CustomCSS() {
  const [css, setCss] = useState("");
  const [saved, setSaved] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    invoke<string>("get_custom_css")
      .then(c => { setCss(c); setSaved(c); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLineCount(css.split("\n").length);
  }, [css]);

  const apply = async () => {
    try {
      await invoke("set_custom_css", { css });
      setSaved(css);
      setMsg("CSS applied! Reload Discord to see changes.");
    } catch {
      setMsg("Applied locally (backend not wired yet).");
    }
    setTimeout(() => setMsg(""), 4000);
  };

  const reset = () => {
    setCss("");
    invoke("set_custom_css", { css: "" }).catch(() => {});
    setMsg("Custom CSS cleared.");
    setTimeout(() => setMsg(""), 3000);
  };

  const copy = () => {
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = css !== saved;

  return (
    <div className="p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Custom CSS</h2>
          <p className="text-sm text-gray-400 mt-1">
            Inject your own CSS directly into Discord
            {isDirty && <span className="ml-2 text-yellow-400">● Unsaved changes</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button onClick={reset} className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-sm">
            <RotateCcw size={14} /> Clear
          </button>
          <button onClick={apply} className="flex items-center gap-2 bg-discord-blurple hover:bg-discord-blurple/80 text-white px-4 py-2 rounded text-sm font-medium">
            <Play size={14} /> Apply CSS
          </button>
        </div>
      </div>

      {msg && (
        <div className="mb-4 p-3 bg-discord-blurple/20 border border-discord-blurple/40 rounded text-sm text-discord-blurple">
          {msg}
        </div>
      )}

      {/* Tips */}
      <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded text-xs text-gray-400 flex gap-3">
        <Code size={14} className="shrink-0 mt-0.5 text-gray-500" />
        <span>
          Use Discord's CSS variables like <code className="text-gray-300 bg-black/20 px-1 rounded">var(--background-primary)</code>, <code className="text-gray-300 bg-black/20 px-1 rounded">var(--text-normal)</code>, <code className="text-gray-300 bg-black/20 px-1 rounded">var(--brand-experiment)</code>.
          Press <kbd className="bg-black/30 px-1 rounded">Ctrl+Enter</kbd> to apply.
        </span>
      </div>

      {/* Editor */}
      <div className="flex flex-1 rounded-lg border border-white/10 overflow-hidden font-mono text-sm bg-discord-dark min-h-[400px]">
        {/* Line numbers */}
        <div className="select-none text-right pr-4 pl-3 pt-3 text-gray-600 leading-6 bg-black/20 border-r border-white/5 min-w-[3rem]">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Textarea */}
        <textarea
          value={css}
          onChange={e => setCss(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); apply(); }
            // Tab inserts spaces
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget;
              const start = t.selectionStart;
              const end = t.selectionEnd;
              const newVal = css.substring(0, start) + "  " + css.substring(end);
              setCss(newVal);
              setTimeout(() => { t.selectionStart = t.selectionEnd = start + 2; }, 0);
            }
          }}
          placeholder={`/* Write your custom CSS here */\n\n/* Example: make the sidebar darker */\n[class*="guilds_"] {\n  background-color: #0d1117;\n}`}
          spellCheck={false}
          className="flex-1 bg-transparent text-gray-200 placeholder-gray-600 p-3 resize-none focus:outline-none leading-6 w-full"
        />
      </div>

      <p className="text-xs text-gray-600 mt-2 text-right">{lineCount} lines · {css.length} characters</p>
    </div>
  );
}
