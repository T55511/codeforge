import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { studentApi } from "../api";
import { useTaskPoller } from "../hooks/useTaskPoller";
import type { Problem, TaskResult, ChatMessage, GiveupResult } from "../types";

export default function WorkspacePage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalResult, setFinalResult] = useState<TaskResult | null>(null);
  const [giveupResult, setGiveupResult] = useState<GiveupResult | null>(null);
  const [givingUp, setGivingUp] = useState(false);
  const [showGiveupConfirm, setShowGiveupConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { result: taskResult, isPolling } = useTaskPoller(taskId);

  useEffect(() => {
    if (!problemId) return;
    studentApi.getProblem(problemId)
      .then((res) => {
        setProblem(res.data);
        setCode(res.data.initial_code || "");
      })
      .catch(() => navigate("/"));
  }, [problemId]);

  useEffect(() => {
    if (taskResult && (taskResult.status === "COMPLETED" || taskResult.status === "FAILED")) {
      setFinalResult(taskResult);
      setShowResult(true);
      setSubmitting(false);
    }
  }, [taskResult]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSubmit = async () => {
    if (!problemId || submitting) return;
    setSubmitting(true);
    setShowResult(false);
    setGiveupResult(null);
    try {
      const res = await studentApi.execute(problemId, code, hintCount);
      setTaskId(res.data.task_id);
    } catch {
      setSubmitting(false);
    }
  };

  const handleChat = async () => {
    if (!problemId || !chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await studentApi.chat(
        problemId,
        userMsg,
        code,
        finalResult?.error?.detail || ""
      );
      setChatMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      setHintCount((n) => n + 1);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGiveup = async () => {
    if (!problemId || givingUp) return;
    setShowGiveupConfirm(false);
    setGivingUp(true);
    try {
      const res = await studentApi.giveup(problemId, code, hintCount);
      setGiveupResult(res.data);
      setShowResult(false);
    } finally {
      setGivingUp(false);
    }
  };

  const difficultyLabel = ["", "入門", "中級", "応用"];
  const alreadyGaveUp = giveupResult !== null;

  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <button style={styles.back} onClick={() => navigate("/")}>← 戻る</button>
        <div style={styles.problemMeta}>
          <span style={styles.title}>{problem?.title}</span>
          {problem && (
            <span style={styles.difficulty}>{difficultyLabel[problem.difficulty]}</span>
          )}
        </div>
        <div style={styles.headerActions}>
          {!alreadyGaveUp && (
            <button
              style={styles.giveupBtn}
              onClick={() => setShowGiveupConfirm(true)}
              disabled={givingUp || submitting || isPolling}
              title="ギブアップして解説を見る（正解コードは表示されません）"
            >
              {givingUp ? "解説生成中..." : "🏳 ギブアップ"}
            </button>
          )}
          <button
            style={{
              ...styles.submitBtn,
              ...(submitting || isPolling || alreadyGaveUp ? styles.submitBtnDisabled : {}),
            }}
            onClick={handleSubmit}
            disabled={submitting || isPolling || alreadyGaveUp}
          >
            {isPolling ? "実行中..." : submitting ? "送信中..." : "▶ 実行"}
          </button>
        </div>
      </header>

      {/* ギブアップ確認ダイアログ */}
      {showGiveupConfirm && (
        <div style={styles.overlay}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>🏳 ギブアップしますか？</h3>
            <p style={styles.dialogText}>
              AIメンターが概念の解説を提供します。<br />
              <strong>正解コードは表示されません。</strong><br />
              ギブアップ後はこの問題の実行ができなくなります。
            </p>
            <div style={styles.dialogActions}>
              <button style={styles.cancelBtn} onClick={() => setShowGiveupConfirm(false)}>
                キャンセル
              </button>
              <button style={styles.confirmBtn} onClick={handleGiveup}>
                ギブアップして解説を見る
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.workspace}>
        {/* 左ペイン: 問題文 + 結果 */}
        <div style={styles.leftPane}>
          <div style={styles.panelTitle}>問題</div>
          <div style={styles.description}>
            {problem?.description || "問題文を読み込み中..."}
          </div>

          {showResult && finalResult && !giveupResult && (
            <ResultPanel result={finalResult} />
          )}

          {giveupResult && (
            <GiveupPanel result={giveupResult} />
          )}
        </div>

        {/* 中央: エディタ */}
        <div style={styles.editorPane}>
          <div style={styles.panelTitle}>
            コードエディタ
            {alreadyGaveUp && (
              <span style={styles.gaveUpBadge}>ギブアップ済み</span>
            )}
          </div>
          <Editor
            height="calc(100vh - 140px)"
            defaultLanguage="python"
            value={code}
            onChange={(val) => setCode(val || "")}
            theme="vs-dark"
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              readOnly: alreadyGaveUp,
            }}
          />
        </div>

        {/* 右ペイン: AIサイドバー */}
        <div style={styles.rightPane}>
          <div style={styles.panelTitle}>
            AIメンター
            {hintCount > 0 && (
              <span style={styles.hintBadge}>ヒント {hintCount}回</span>
            )}
          </div>
          <div style={styles.chatMessages}>
            {chatMessages.length === 0 && (
              <p style={styles.chatEmpty}>
                困ったことがあれば質問してください。ヒントを提供します（答えは教えません）。
              </p>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  ...styles.chatBubble,
                  ...(msg.role === "user" ? styles.userBubble : styles.aiBubble),
                }}
              >
                <strong style={styles.roleName}>{msg.role === "user" ? "あなた" : "AI"}</strong>
                <p style={styles.bubbleText}>{msg.content}</p>
              </div>
            ))}
            {chatLoading && (
              <div style={{ ...styles.chatBubble, ...styles.aiBubble }}>
                <p style={styles.bubbleText}>考え中...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={styles.chatInput}>
            <textarea
              style={styles.chatTextarea}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="質問を入力..."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChat();
                }
              }}
            />
            <button style={styles.chatSend} onClick={handleChat} disabled={chatLoading}>
              送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- 実行結果パネル ----
function ResultPanel({ result }: { result: TaskResult }) {
  const isPass = result.verdict === "PASS";

  return (
    <div style={{ ...resultStyles.panel, borderColor: isPass ? "#238636" : "#f85149" }}>
      <div style={{ ...resultStyles.verdict, color: isPass ? "#3fb950" : "#f85149" }}>
        {isPass
          ? "✓ PASS"
          : result.verdict === "TIMEOUT"
          ? "⏱ タイムアウト"
          : result.verdict === "ERROR"
          ? "✗ エラー"
          : "✗ FAIL"}
      </div>

      {result.error && (
        <div style={resultStyles.errorBlock}>
          <div style={resultStyles.errorType}>
            {result.error.error_type}
            {result.error.line_number ? ` (${result.error.line_number}行目)` : ""}
          </div>
          <div style={resultStyles.errorMsg}>{result.error.message_ja}</div>
        </div>
      )}

      {result.diff && (
        <div style={resultStyles.diffBlock}>
          <div style={resultStyles.diffTitle}>差分：</div>
          <pre style={resultStyles.pre}>{result.diff}</pre>
        </div>
      )}

      {result.failed_case && (
        <div style={resultStyles.diffBlock}>
          <div style={resultStyles.diffTitle}>
            テストケース {result.failed_case.case_index} 失敗：
          </div>
          <pre style={resultStyles.pre}>
            {"入力: " + result.failed_case.input + "\n"}
            {"期待: " + result.failed_case.expected + "\n"}
            {"実際: " + result.failed_case.actual}
          </pre>
        </div>
      )}

      {isPass && result.exp_breakdown && (
        <div style={resultStyles.expBlock}>
          <div style={resultStyles.expTitle}>+{result.exp_earned} EXP 獲得！</div>
          <div style={resultStyles.expGrid}>
            <span>基本: +{result.exp_breakdown.base}</span>
            {result.exp_breakdown.first_try > 0 && (
              <span>一発正解: +{result.exp_breakdown.first_try}</span>
            )}
            {result.exp_breakdown.no_hint > 0 && (
              <span>ノーヒント: +{result.exp_breakdown.no_hint}</span>
            )}
            {result.exp_breakdown.clean_code > 0 && (
              <span>クリーン: +{result.exp_breakdown.clean_code}</span>
            )}
            {result.exp_breakdown.efficient > 0 && (
              <span>高効率: +{result.exp_breakdown.efficient}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- ギブアップ解説パネル ----
function GiveupPanel({ result }: { result: GiveupResult }) {
  return (
    <div style={giveupStyles.panel}>
      <div style={giveupStyles.header}>
        <span style={giveupStyles.icon}>🏳</span>
        <span style={giveupStyles.title}>ギブアップ解説</span>
      </div>

      <p style={giveupStyles.explanation}>{result.explanation}</p>

      {result.key_concepts.length > 0 && (
        <div style={giveupStyles.conceptsBlock}>
          <div style={giveupStyles.conceptsTitle}>今回学ぶべきキーコンセプト</div>
          <div style={giveupStyles.conceptsList}>
            {result.key_concepts.map((c, i) => (
              <span key={i} style={giveupStyles.concept}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <p style={giveupStyles.footer}>
        ヒント使用回数: {result.hints_used}回 ／ もう一度チャレンジするには問題一覧から選択してください。
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { height: "100vh", display: "flex", flexDirection: "column" as const, background: "#0d1117" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "10px 20px",
    background: "#161b22",
    borderBottom: "1px solid #21262d",
    flexShrink: 0,
  },
  back: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12 },
  problemMeta: { flex: 1, display: "flex", alignItems: "center", gap: 12 },
  title: { fontWeight: 600, fontSize: 15 },
  difficulty: { background: "#21262d", color: "#8b949e", borderRadius: 12, padding: "2px 10px", fontSize: 12 },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },
  submitBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "7px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  submitBtnDisabled: { background: "#1c4428", cursor: "not-allowed", opacity: 0.7 },
  giveupBtn: {
    background: "none",
    border: "1px solid #6e7681",
    color: "#8b949e",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 13,
    cursor: "pointer",
  },
  workspace: { display: "flex", flex: 1, overflow: "hidden" },
  leftPane: { width: 320, borderRight: "1px solid #21262d", display: "flex", flexDirection: "column" as const, overflow: "auto", padding: 16 },
  editorPane: { flex: 1, display: "flex", flexDirection: "column" as const },
  rightPane: { width: 300, borderLeft: "1px solid #21262d", display: "flex", flexDirection: "column" as const },
  panelTitle: {
    color: "#8b949e",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: "8px 0",
    borderBottom: "1px solid #21262d",
    marginBottom: 12,
    letterSpacing: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  gaveUpBadge: { background: "#6e40c9", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 600, textTransform: "none" as const },
  hintBadge: { background: "#9a6700", color: "#fff", borderRadius: 10, padding: "1px 8px", fontSize: 10, fontWeight: 600, textTransform: "none" as const },
  description: { color: "#c9d1d9", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" as const },
  chatMessages: { flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column" as const, gap: 10 },
  chatEmpty: { color: "#8b949e", fontSize: 13, lineHeight: 1.6 },
  chatBubble: { borderRadius: 8, padding: "10px 12px" },
  userBubble: { background: "#1f3a5f", marginLeft: 20 },
  aiBubble: { background: "#161b22", border: "1px solid #21262d", marginRight: 20 },
  roleName: { fontSize: 11, color: "#8b949e", display: "block", marginBottom: 4 },
  bubbleText: { fontSize: 13, lineHeight: 1.6, color: "#e6edf3" },
  chatInput: { padding: 10, borderTop: "1px solid #21262d", display: "flex", gap: 8 },
  chatTextarea: { flex: 1, background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#e6edf3", padding: "8px 10px", fontSize: 13, resize: "none" as const },
  chatSend: { background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, padding: "0 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  // ギブアップ確認ダイアログ
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  dialog: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: 28,
    maxWidth: 420,
    width: "90%",
  },
  dialogTitle: { fontSize: 18, fontWeight: 700, marginBottom: 12 },
  dialogText: { color: "#c9d1d9", fontSize: 14, lineHeight: 1.7, marginBottom: 20 },
  dialogActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 14 },
  confirmBtn: { background: "#6e40c9", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontSize: 14, fontWeight: 600 },
};

const resultStyles: Record<string, React.CSSProperties> = {
  panel: { marginTop: 20, border: "1px solid", borderRadius: 8, padding: 14 },
  verdict: { fontWeight: 700, fontSize: 18, marginBottom: 10 },
  errorBlock: { background: "#1c1c1c", borderRadius: 6, padding: 10, marginBottom: 8 },
  errorType: { color: "#f85149", fontSize: 11, fontWeight: 700, marginBottom: 4 },
  errorMsg: { color: "#e6edf3", fontSize: 13 },
  diffBlock: { marginTop: 8 },
  diffTitle: { color: "#8b949e", fontSize: 11, marginBottom: 4 },
  pre: { background: "#0d1117", borderRadius: 4, padding: 8, fontSize: 12, color: "#e6edf3", overflow: "auto" as const },
  expBlock: { marginTop: 10, background: "#1a2d0e", borderRadius: 6, padding: 10 },
  expTitle: { color: "#3fb950", fontWeight: 700, fontSize: 16, marginBottom: 6 },
  expGrid: { display: "flex", flexWrap: "wrap" as const, gap: 8, fontSize: 12, color: "#8b949e" },
};

const giveupStyles: Record<string, React.CSSProperties> = {
  panel: {
    marginTop: 20,
    border: "1px solid #6e40c9",
    borderRadius: 8,
    padding: 14,
    background: "#1a1040",
  },
  header: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  icon: { fontSize: 20 },
  title: { fontWeight: 700, fontSize: 16, color: "#b392f0" },
  explanation: { color: "#c9d1d9", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" as const, marginBottom: 14 },
  conceptsBlock: { marginBottom: 12 },
  conceptsTitle: { color: "#8b949e", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, marginBottom: 8, letterSpacing: 1 },
  conceptsList: { display: "flex", flexWrap: "wrap" as const, gap: 6 },
  concept: { background: "#2d1b69", color: "#b392f0", borderRadius: 12, padding: "3px 10px", fontSize: 12, fontWeight: 500 },
  footer: { color: "#6e7681", fontSize: 11, borderTop: "1px solid #21262d", paddingTop: 10, marginTop: 4 },
};
