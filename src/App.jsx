import { useState, useRef, useEffect } from "react";

const MAX_Q = 4;

const EXAMPLES = [
  "A girl finds a magic key 🗝️",
  "A dragon wants to be a chef 🐉",
  "A mirror whispers at night 🪞",
  "Two friends get lost underground 🌀",
];

const MOODS = [
  { label: "😄 Funny",        value: "funny and full of jokes" },
  { label: "🔮 Magical",      value: "magical and full of wonder" },
  { label: "😱 Suspenseful",  value: "suspenseful and thrilling" },
  { label: "🥺 Emotional",    value: "emotional and heartwarming" },
  { label: "⚔️ Adventure",    value: "action-packed and adventurous" },
  { label: "👻 Spooky",       value: "spooky but not too scary" },
];

const REWRITES = [
  { label: "😱 More Suspense", style: "more suspenseful" },
  { label: "😂 Funnier",       style: "funnier with jokes" },
  { label: "🥺 More Emotional",style: "more emotional" },
  { label: "😮 Bigger Twist",  style: "with a bigger twist" },
  { label: "👧 Simpler",       style: "simpler for young kids" },
  { label: "⚔️ More Action",   style: "with more action" },
];

const F_TITLE = "'Baloo 2', cursive";
const F_BODY  = "'Nunito', sans-serif";

async function askClaude(userMessage) {
  const res = await fetch("/api/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

export default function App() {
  const [screen, setScreen]   = useState("welcome");
  const [idea, setIdea]       = useState("");
  const [msgs, setMsgs]       = useState([]);
  const [answers, setAnswers] = useState([]);
  const [qrs, setQrs]         = useState([]);
  const [typed, setTyped]     = useState("");
  const [qCount, setQCount]   = useState(0);
  const [story, setStory]     = useState("");
  const [loadMsg, setLoadMsg] = useState("Building your story...");
  const [busy, setBusy]       = useState(false);
  const [mood, setMood]       = useState("");
  const [customMood, setCustomMood] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;800&family=Nunito:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const addMsg = (role, text) => setMsgs(prev => [...prev, { role, text }]);

  async function startChat() {
    if (!idea.trim()) return;
    setMsgs([]); setAnswers([]); setQrs([]); setQCount(0); setMood(""); setCustomMood("");
    setScreen("chat");
    await doAskQuestion(idea, [], 0);
  }

  async function doAskQuestion(currentIdea, currentAnswers, currentCount) {
    setBusy(true);
    const aText = currentAnswers.length
      ? `\nAnswers so far: ${currentAnswers.map((a, i) => `${i+1}. ${a}`).join(", ")}`
      : "";
    const prompt = `You are Spark, a fun storytelling guide for kids aged 8-12.
Story idea: "${currentIdea}"${aText}
Questions asked: ${currentCount} of ${MAX_Q}.
Ask ONE short fun question about the most important missing story element.
Reply ONLY with JSON, no other text: {"question":"...?","options":["A","B","C","Surprise me! 🎲"]}`;

    try {
      const raw = await askClaude(prompt);
      const clean = raw.replace(/```json|```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(clean); }
      catch {
        const m = clean.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { question: "What happens next?", options: ["Magic!", "A problem!", "A friend helps!", "Surprise me! 🎲"] };
      }
      addMsg("ai", parsed.question);
      setQrs(parsed.options || []);
      setQCount(currentCount + 1);
    } catch (e) {
      addMsg("ai", `Error: ${e.message}`);
    }
    setBusy(false);
  }

  async function sendMsg(text) {
    const t = text || typed.trim();
    if (!t || busy) return;
    setTyped(""); setQrs([]);
    addMsg("user", t);
    const newAns = [...answers, t];
    setAnswers(newAns);
    if (qCount >= MAX_Q) {
      // Go to mood screen instead of generating directly
      setAnswers(newAns);
      setScreen("mood");
    } else {
      await doAskQuestion(idea, newAns, qCount);
    }
  }

  function selectMood(val) {
    setMood(val);
    setCustomMood("");
  }

  function confirmMood() {
    const finalMood = customMood.trim() || mood;
    if (!finalMood) return;
    doGenerate(idea, answers, null, finalMood);
  }

  async function doGenerate(currentIdea, currentAnswers, rewriteStyle, storyMood) {
    setScreen("loading");
    const steps = ["Building your world... 🌍", "Creating characters... 🧙", "Adding a twist... 😮", "Writing the ending... 🌟"];
    let i = 0;
    const timer = setInterval(() => setLoadMsg(steps[i++ % steps.length]), 1200);

    const aText   = currentAnswers.length ? `Details: ${currentAnswers.join(", ")}. ` : "";
    const rText   = rewriteStyle ? `Make it ${rewriteStyle}. Keep same characters. ` : "";
    const mText   = storyMood ? `The mood of the story should be: ${storyMood}. ` : "";
    const oText   = rewriteStyle && story ? `Original story: ${story}\n\n` : "";

    const prompt = `${oText}Write a fun short story (400-500 words) for kids aged 8-12.
Idea: "${currentIdea}". ${aText}${mText}${rText}
Must have: exciting opening, main character, clear problem, exciting moment, happy ending.
Write ONLY the story. No title. Simple fun language.`;

    try {
      const result = await askClaude(prompt);
      clearInterval(timer);
      setStory(result);
      setScreen("story");
    } catch (e) {
      clearInterval(timer);
      setScreen("chat");
      addMsg("ai", `Could not generate story: ${e.message}`);
    }
  }

  // ── SHARED STYLES ───────────────────────────────────────────────
  const bg  = { minHeight: "100vh", background: "#fff9f0", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: F_BODY };
  const card = { background: "white", borderRadius: 28, padding: "32px 28px", boxShadow: "0 8px 40px rgba(255,140,60,0.12)", border: "3px solid #ffe0c0", width: "100%", maxWidth: 460 };
  const btnOrange = { background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", color: "white", border: "none", borderRadius: 50, padding: "15px 24px", fontSize: 19, fontWeight: 800, fontFamily: F_TITLE, cursor: "pointer", width: "100%", marginTop: 8, boxShadow: "0 4px 20px rgba(255,107,53,0.3)" };
  const btnWhite  = { background: "white", color: "#ff6b35", border: "2.5px solid #ff6b35", borderRadius: 50, padding: "13px 24px", fontSize: 16, fontWeight: 800, fontFamily: F_TITLE, cursor: "pointer", width: "100%", marginTop: 10 };

  // ── WELCOME ─────────────────────────────────────────────────────
  if (screen === "welcome") return (
    <div style={bg}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✨</div>
        <div style={{ fontFamily: F_TITLE, fontSize: 38, fontWeight: 800, color: "#ff6b35", marginBottom: 8 }}>StorySpark</div>
        <div style={{ fontFamily: F_BODY, fontSize: 16, color: "#999", marginBottom: 32 }}>Turn any idea into an amazing story!</div>
        <button style={btnOrange} onClick={() => setScreen("idea")}>🚀 Let's Make a Story!</button>
      </div>
    </div>
  );

  // ── IDEA INPUT ──────────────────────────────────────────────────
  if (screen === "idea") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ fontFamily: F_TITLE, fontSize: 22, fontWeight: 800, color: "#ff6b35", marginBottom: 6 }}>💡 Your Story Idea</div>
        <div style={{ fontFamily: F_BODY, fontSize: 14, color: "#aaa", marginBottom: 18 }}>Write anything — even one sentence is enough!</div>
        <textarea
          rows={4}
          value={idea}
          onChange={e => setIdea(e.target.value)}
          placeholder="A dragon wants to become a chef..."
          style={{ width: "100%", border: "2.5px solid #ffe0c0", borderRadius: 16, padding: 16, fontSize: 16, fontFamily: F_BODY, resize: "none", outline: "none", background: "#fffaf5", lineHeight: 1.5, color: "#333" }}
        />
        <div style={{ marginTop: 12, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLES.map(ex => (
            <span key={ex} onClick={() => setIdea(ex)}
              style={{ background: "#fff3e8", border: "2px solid #ffd4a8", borderRadius: 50, padding: "6px 14px", fontSize: 13, fontFamily: F_BODY, fontWeight: 700, color: "#cc6600", cursor: "pointer" }}>
              {ex}
            </span>
          ))}
        </div>
        <button style={btnOrange} onClick={startChat}>✨ Start My Story!</button>
      </div>
    </div>
  );

  // ── CHAT ────────────────────────────────────────────────────────
  if (screen === "chat") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🧚</div>
          <div>
            <div style={{ fontFamily: F_TITLE, fontWeight: 800, fontSize: 19, color: "#333" }}>Spark</div>
            <div style={{ fontFamily: F_BODY, fontSize: 13, color: "#aaa" }}>Your story guide ✨</div>
          </div>
        </div>
        <div style={{ background: "#ffe0c0", borderRadius: 50, height: 8, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(90deg,#ff6b35,#ff9f1c)", height: "100%", width: `${Math.min((qCount / MAX_Q) * 80 + 5, 80)}%`, borderRadius: 50, transition: "width 0.5s" }} />
        </div>
        <div style={{ minHeight: 160, marginBottom: 14, maxHeight: 300, overflowY: "auto" }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8, marginBottom: 14 }}>
              {m.role === "ai" && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, marginTop: 2 }}>🧚</div>
              )}
              <div style={m.role === "ai"
                ? { fontFamily: F_BODY, background: "#fff3e8", border: "2px solid #ffd4a8", borderRadius: 18, borderTopLeftRadius: 4, padding: "12px 16px", fontSize: 15, color: "#333", maxWidth: "80%", lineHeight: 1.5 }
                : { fontFamily: F_BODY, background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", borderRadius: 18, borderBottomRightRadius: 4, padding: "12px 16px", fontSize: 15, color: "white", maxWidth: "80%", lineHeight: 1.5 }
              }>{m.text}</div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🧚</div>
              <div style={{ fontFamily: F_BODY, background: "#fff3e8", border: "2px solid #ffd4a8", borderRadius: 18, borderTopLeftRadius: 4, padding: "12px 16px", fontSize: 14, color: "#bbb" }}>thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {qrs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {qrs.map(qr => (
              <button key={qr} onClick={() => sendMsg(qr)}
                style={{ fontFamily: F_BODY, background: "white", border: "2.5px solid #ffd4a8", borderRadius: 50, padding: "8px 16px", fontSize: 14, fontWeight: 700, color: "#cc6600", cursor: "pointer" }}>
                {qr}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMsg()}
            placeholder="Type your answer..."
            style={{ flex: 1, border: "2.5px solid #ffe0c0", borderRadius: 50, padding: "12px 18px", fontSize: 15, fontFamily: F_BODY, outline: "none", background: "#fffaf5" }}
          />
          <button onClick={() => sendMsg()}
            style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#ff6b35,#ff9f1c)", border: "none", fontSize: 20, cursor: "pointer", color: "white", flexShrink: 0 }}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );

  // ── MOOD ────────────────────────────────────────────────────────
  if (screen === "mood") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🎨</div>
          <div style={{ fontFamily: F_TITLE, fontSize: 24, fontWeight: 800, color: "#ff6b35", marginBottom: 6 }}>What's the mood?</div>
          <div style={{ fontFamily: F_BODY, fontSize: 14, color: "#aaa" }}>Pick one — or write your own below!</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {MOODS.map(m => (
            <button key={m.value} onClick={() => selectMood(m.value)}
              style={{
                fontFamily: F_BODY, fontWeight: 700, fontSize: 15,
                background: mood === m.value ? "linear-gradient(135deg,#ff6b35,#ff9f1c)" : "white",
                color: mood === m.value ? "white" : "#cc6600",
                border: mood === m.value ? "2.5px solid #ff6b35" : "2.5px solid #ffd4a8",
                borderRadius: 16, padding: "14px 8px", cursor: "pointer",
                transition: "all 0.15s",
              }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ fontFamily: F_BODY, fontSize: 13, color: "#aaa", marginBottom: 8, fontWeight: 700 }}>✏️ Or write your own mood:</div>
        <input
          value={customMood}
          onChange={e => { setCustomMood(e.target.value); if (e.target.value) setMood(""); }}
          placeholder="e.g. dreamy, silly, mysterious..."
          style={{ width: "100%", border: "2.5px solid #ffe0c0", borderRadius: 50, padding: "12px 18px", fontSize: 15, fontFamily: F_BODY, outline: "none", background: "#fffaf5", marginBottom: 16 }}
        />
        <button
          style={{ ...btnOrange, opacity: (mood || customMood.trim()) ? 1 : 0.4 }}
          onClick={confirmMood}
          disabled={!mood && !customMood.trim()}>
          ✨ Write My Story!
        </button>
      </div>
    </div>
  );

  // ── LOADING ─────────────────────────────────────────────────────
  if (screen === "loading") return (
    <div style={bg}>
      <div style={{ ...card, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>⭐</div>
        <div style={{ fontFamily: F_TITLE, fontSize: 20, fontWeight: 700, color: "#ff6b35", marginBottom: 8 }}>{loadMsg}</div>
        <div style={{ fontFamily: F_BODY, fontSize: 14, color: "#aaa" }}>A few more seconds!</div>
      </div>
    </div>
  );

  // ── STORY ───────────────────────────────────────────────────────
  if (screen === "story") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📖</div>
          <div style={{ fontFamily: F_TITLE, fontSize: 26, fontWeight: 800, color: "#ff6b35" }}>Your Story!</div>
        </div>
        <div style={{ fontFamily: F_BODY, background: "#fffaf5", border: "2.5px solid #ffe0c0", borderRadius: 20, padding: 24, fontSize: 16, lineHeight: 1.8, color: "#444", marginBottom: 20, maxHeight: 320, overflowY: "auto", whiteSpace: "pre-wrap" }}>
          {story}
        </div>
        <div style={{ fontFamily: F_BODY, fontSize: 11, fontWeight: 700, color: "#ffb347", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>✨ Make it even better:</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {REWRITES.map(r => (
            <button key={r.style} onClick={() => doGenerate(idea, answers, r.style, mood || customMood)}
              style={{ fontFamily: F_BODY, background: "white", border: "2px solid #ffd4a8", borderRadius: 14, padding: "11px 8px", fontSize: 13, fontWeight: 700, color: "#cc6600", cursor: "pointer" }}>
              {r.label}
            </button>
          ))}
        </div>
        <button style={btnWhite} onClick={() => { setIdea(""); setStory(""); setScreen("idea"); }}>🌟 Write a New Story</button>
      </div>
    </div>
  );

  return null;
}
