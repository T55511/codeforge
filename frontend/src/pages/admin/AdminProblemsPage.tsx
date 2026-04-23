import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { adminApi } from "../../api";
import type { Language } from "../../types";

interface Problem {
  id: string;
  language_id: string;
  tag_id: string;
  title: string;
  description: string;
  initial_code: string;
  solution: string;
  judgment_type: string;
  test_cases: Array<{ input: string; expected_output: string }> | null;
  expected_output: string | null;
  difficulty: number;
  status: string;
  source: string;
  efficiency_threshold_ms: number | null;
  efficiency_threshold_kb: number | null;
  created_at: string;
}

interface Tag { id: string; name: string; category: string; }

const DIFFICULTY_LABEL = ["", "入門", "中級", "応用"];
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  AUTO_GENERATED: { bg: "#2d1b00", color: "#f0c946" },
  APPROVED: { bg: "#1a3d25", color: "#3fb950" },
  ARCHIVED: { bg: "#21262d", color: "#6e7681" },
};

type CreateForm = {
  title: string; description: string; initial_code: string; solution: string;
  judgment_type: string; expected_output: string; difficulty: string;
  tag_id: string; language_id: string; source: string;
  efficiency_threshold_ms: string; efficiency_threshold_kb: string;
};
const EMPTY_FORM: CreateForm = {
  title: "", description: "", initial_code: "", solution: "",
  judgment_type: "STDOUT", expected_output: "", difficulty: "1",
  tag_id: "", language_id: "", source: "MANUAL",
  efficiency_threshold_ms: "", efficiency_threshold_kb: "",
};

type TestCaseRow = { input: string; expected_output: string };

export default function AdminProblemsPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterLang, setFilterLang] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [testCaseRows, setTestCaseRows] = useState<TestCaseRow[]>([{ input: "", expected_output: "" }]);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [generatingLang, setGeneratingLang] = useState("");
  const [generatingTag, setGeneratingTag] = useState("");
  const [generatingDiff, setGeneratingDiff] = useState("1");
  const [generatingCount, setGeneratingCount] = useState("5");
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadLanguages = () => adminApi.getLanguages().then((r) => setLanguages(r.data));
  const loadTags = (langId: string) => {
    if (!langId) { setTags([]); return; }
    adminApi.getTags(langId).then((r) => setTags(r.data as Tag[]));
  };
  const loadProblems = () => {
    setLoading(true);
    adminApi.getProblems({
      language_id: filterLang || undefined,
      tag_id: filterTag || undefined,
      status: filterStatus || undefined,
    }).then((r) => setProblems(r.data as Problem[])).finally(() => setLoading(false));
  };

  useEffect(() => { loadLanguages(); }, []);
  useEffect(() => { loadTags(filterLang); }, [filterLang]);
  useEffect(() => { loadProblems(); }, [filterLang, filterTag, filterStatus]);

  // フォームの言語変更に合わせてタグをロード
  useEffect(() => { loadTags(form.language_id); }, [form.language_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        initial_code: form.initial_code,
        solution: form.solution,
        judgment_type: form.judgment_type,
        difficulty: Number(form.difficulty),
        language_id: form.language_id,
        tag_id: form.tag_id,
        source: "MANUAL",
      };
      if (form.judgment_type === "STDOUT") {
        payload.expected_output = form.expected_output;
      } else {
        payload.test_cases = testCaseRows.filter((r) => r.input || r.expected_output);
      }
      if (form.efficiency_threshold_ms) payload.efficiency_threshold_ms = Number(form.efficiency_threshold_ms);
      if (form.efficiency_threshold_kb) payload.efficiency_threshold_kb = Number(form.efficiency_threshold_kb);

      await adminApi.createProblem(payload);
      flash("ok", "問題を作成しました（AUTO_GENERATED）");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setTestCaseRows([{ input: "", expected_output: "" }]);
      loadProblems();
    } catch {
      flash("err", "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (problem: Problem, newStatus: string) => {
    await adminApi.updateProblem(problem.id, { status: newStatus });
    flash("ok", `ステータスを「${newStatus}」に変更しました`);
    loadProblems();
  };

  const handleTest = async (problem: Problem) => {
    setTestingId(problem.id);
    try {
      const r = await adminApi.testProblem(problem.id);
      setTestResult((prev) => ({ ...prev, [problem.id]: r.data }));
      setExpandedId(problem.id);
    } catch {
      flash("err", "テスト実行に失敗しました");
    } finally {
      setTestingId(null);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await adminApi.generateProblems({
        language_id: generatingLang,
        tag_id: generatingTag,
        difficulty: Number(generatingDiff),
        count: Number(generatingCount),
      });
      flash("ok", `AI生成タスクをキューに追加しました（${generatingCount}問）`);
      setShowGenerate(false);
    } catch {
      flash("err", "生成タスクの追加に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const langName = (id: string) => languages.find((l) => l.id === id)?.name ?? "";
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name ?? "";

  return (
    <AdminLayout>
      <div style={styles.header}>
        <h1 style={styles.title}>📝 問題管理</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.genBtn} onClick={() => { setShowGenerate(true); setShowCreate(false); }}>
            🤖 AI一括生成
          </button>
          <button style={styles.addBtn} onClick={() => { setShowCreate(true); setShowGenerate(false); }}>
            + 問題を追加
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ ...styles.flash, ...(msg.type === "ok" ? styles.flashOk : styles.flashErr) }}>
          {msg.text}
        </div>
      )}

      {/* フィルター */}
      <div style={styles.filters}>
        <select style={styles.select} value={filterLang} onChange={(e) => { setFilterLang(e.target.value); setFilterTag(""); }}>
          <option value="">すべての言語</option>
          {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select style={styles.select} value={filterTag} onChange={(e) => setFilterTag(e.target.value)} disabled={!filterLang}>
          <option value="">すべてのスキル</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select style={styles.select} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">すべてのステータス</option>
          <option value="AUTO_GENERATED">AUTO_GENERATED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <span style={styles.count}>{problems.length}件</span>
      </div>

      {/* AI一括生成フォーム */}
      {showGenerate && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>🤖 AI問題一括生成</h2>
          <form onSubmit={handleGenerate} style={styles.formGrid2}>
            <div style={styles.formRow}>
              <label style={styles.label}>言語</label>
              <select style={styles.selectFull} value={generatingLang} onChange={(e) => { setGeneratingLang(e.target.value); loadTags(e.target.value); }} required>
                <option value="">選択</option>
                {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>スキル</label>
              <select style={styles.selectFull} value={generatingTag} onChange={(e) => setGeneratingTag(e.target.value)} required disabled={!generatingLang}>
                <option value="">選択</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>難易度</label>
              <select style={styles.selectFull} value={generatingDiff} onChange={(e) => setGeneratingDiff(e.target.value)}>
                <option value="1">入門</option>
                <option value="2">中級</option>
                <option value="3">応用</option>
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>生成数</label>
              <input style={styles.input} type="number" min="1" max="20" value={generatingCount} onChange={(e) => setGeneratingCount(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={styles.cancelBtn} onClick={() => setShowGenerate(false)}>キャンセル</button>
              <button type="submit" style={styles.saveBtn} disabled={generating}>{generating ? "キュー追加中..." : "生成タスクを追加"}</button>
            </div>
          </form>
        </div>
      )}

      {/* 問題作成フォーム */}
      {showCreate && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>問題を追加（手動）</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={styles.formGrid2}>
              <div style={styles.formRow}>
                <label style={styles.label}>言語</label>
                <select style={styles.selectFull} value={form.language_id} onChange={(e) => setForm({ ...form, language_id: e.target.value, tag_id: "" })} required>
                  <option value="">選択</option>
                  {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>スキル</label>
                <select style={styles.selectFull} value={form.tag_id} onChange={(e) => setForm({ ...form, tag_id: e.target.value })} required disabled={!form.language_id}>
                  <option value="">選択</option>
                  {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>難易度</label>
                <select style={styles.selectFull} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="1">1 - 入門</option>
                  <option value="2">2 - 中級</option>
                  <option value="3">3 - 応用</option>
                </select>
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>判定方式</label>
                <select style={styles.selectFull} value={form.judgment_type} onChange={(e) => setForm({ ...form, judgment_type: e.target.value })}>
                  <option value="STDOUT">STDOUT（出力比較）</option>
                  <option value="TESTCASE">TESTCASE（関数assert）</option>
                </select>
              </div>
            </div>

            <div style={styles.formRow}>
              <label style={styles.label}>タイトル</label>
              <input style={styles.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="例: FizzBuzz を実装しよう" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>問題文</label>
              <textarea style={{ ...styles.input, minHeight: 100, resize: "vertical" as const }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="問題の説明を入力..." />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>初期コード（エディタ初期表示）</label>
              <textarea style={{ ...styles.input, minHeight: 80, fontFamily: "monospace", resize: "vertical" as const }} value={form.initial_code} onChange={(e) => setForm({ ...form, initial_code: e.target.value })} placeholder="# ここにコードを書いてください" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>模範解答</label>
              <textarea style={{ ...styles.input, minHeight: 100, fontFamily: "monospace", resize: "vertical" as const }} value={form.solution} onChange={(e) => setForm({ ...form, solution: e.target.value })} required placeholder="正解のコードを入力..." />
            </div>

            {form.judgment_type === "STDOUT" ? (
              <div style={styles.formRow}>
                <label style={styles.label}>期待する標準出力</label>
                <textarea style={{ ...styles.input, minHeight: 60, fontFamily: "monospace", resize: "vertical" as const }} value={form.expected_output} onChange={(e) => setForm({ ...form, expected_output: e.target.value })} placeholder="期待する出力（前後の空白はトリムされます）" />
              </div>
            ) : (
              <div style={styles.formRow}>
                <label style={styles.label}>テストケース（TESTCASE モード）</label>
                {testCaseRows.map((row, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <input style={{ ...styles.input, flex: 1 }} placeholder={`入力 #${i + 1}`} value={row.input} onChange={(e) => {
                      const next = [...testCaseRows]; next[i].input = e.target.value; setTestCaseRows(next);
                    }} />
                    <input style={{ ...styles.input, flex: 1 }} placeholder={`期待出力 #${i + 1}`} value={row.expected_output} onChange={(e) => {
                      const next = [...testCaseRows]; next[i].expected_output = e.target.value; setTestCaseRows(next);
                    }} />
                    {testCaseRows.length > 1 && (
                      <button type="button" style={styles.removeBtn} onClick={() => setTestCaseRows(testCaseRows.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" style={styles.addRowBtn} onClick={() => setTestCaseRows([...testCaseRows, { input: "", expected_output: "" }])}>
                  + ケースを追加
                </button>
              </div>
            )}

            <div style={styles.formGrid2}>
              <div style={styles.formRow}>
                <label style={styles.label}>効率基準（実行時間 ms、任意）</label>
                <input style={styles.input} type="number" value={form.efficiency_threshold_ms} onChange={(e) => setForm({ ...form, efficiency_threshold_ms: e.target.value })} placeholder="例: 100" />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>効率基準（メモリ KB、任意）</label>
                <input style={styles.input} type="number" value={form.efficiency_threshold_kb} onChange={(e) => setForm({ ...form, efficiency_threshold_kb: e.target.value })} placeholder="例: 10240" />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setTestCaseRows([{ input: "", expected_output: "" }]); }}>キャンセル</button>
              <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? "作成中..." : "問題を作成"}</button>
            </div>
          </form>
        </div>
      )}

      {/* 問題一覧 */}
      {loading ? (
        <p style={styles.loading}>読み込み中...</p>
      ) : (
        <div style={styles.list}>
          {problems.map((p) => (
            <div key={p.id} style={styles.problemCard}>
              <div style={styles.problemHeader} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                <div style={styles.problemLeft}>
                  <span style={{ ...styles.statusBadge, ...STATUS_COLORS[p.status] }}>{p.status}</span>
                  <span style={styles.diffBadge}>{DIFFICULTY_LABEL[p.difficulty]}</span>
                  <span style={styles.typeBadge}>{p.judgment_type}</span>
                  <span style={styles.problemTitle}>{p.title}</span>
                </div>
                <div style={styles.problemMeta}>
                  <span style={styles.metaText}>{langName(p.language_id)}</span>
                  <span style={styles.metaText}>{p.source === "AI_GENERATED" ? "🤖 AI生成" : "✍ 手動"}</span>
                  <span style={styles.metaText}>{new Date(p.created_at).toLocaleDateString("ja-JP")}</span>
                  <span style={styles.expandIcon}>{expandedId === p.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {expandedId === p.id && (
                <div style={styles.problemBody}>
                  <div style={styles.problemDesc}>{p.description}</div>

                  {/* テスト実行結果 */}
                  {testResult[p.id] && (
                    <div style={{
                      ...styles.testResultBox,
                      borderColor: testResult[p.id].verdict === "PASS" ? "#238636" : "#cf222e",
                    }}>
                      <strong style={{ color: testResult[p.id].verdict === "PASS" ? "#3fb950" : "#f85149" }}>
                        テスト実行: {testResult[p.id].verdict}
                      </strong>
                      {testResult[p.id].error && (
                        <p style={{ color: "#f85149", fontSize: 12, marginTop: 4 }}>
                          {testResult[p.id].error.message_ja}
                        </p>
                      )}
                      {testResult[p.id].diff && (
                        <pre style={styles.pre}>{testResult[p.id].diff}</pre>
                      )}
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div style={styles.problemActions}>
                    <button
                      style={styles.testBtn}
                      onClick={() => handleTest(p)}
                      disabled={testingId === p.id}
                    >
                      {testingId === p.id ? "実行中..." : "▶ テスト実行"}
                    </button>
                    {p.status === "AUTO_GENERATED" && (
                      <button style={styles.approveBtn} onClick={() => handleStatusChange(p, "APPROVED")}>
                        ✓ 承認
                      </button>
                    )}
                    {p.status === "APPROVED" && (
                      <button style={styles.archiveBtn} onClick={() => handleStatusChange(p, "ARCHIVED")}>
                        アーカイブ
                      </button>
                    )}
                    {p.status === "ARCHIVED" && (
                      <button style={styles.restoreBtn} onClick={() => handleStatusChange(p, "AUTO_GENERATED")}>
                        復元（AUTO_GENERATED へ）
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {problems.length === 0 && (
            <p style={styles.empty}>条件に一致する問題がありません。</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700 },
  addBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  genBtn: { background: "#6e40c9", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  flash: { borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 14 },
  flashOk: { background: "#1a3d25", color: "#3fb950", border: "1px solid #238636" },
  flashErr: { background: "#3a0a0a", color: "#f85149", border: "1px solid #cf222e" },
  filters: { display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" as const },
  select: { background: "#161b22", border: "1px solid #30363d", borderRadius: 6, padding: "7px 10px", color: "#e6edf3", fontSize: 13 },
  selectFull: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", color: "#e6edf3", fontSize: 14, width: "100%" },
  count: { color: "#8b949e", fontSize: 13 },
  loading: { color: "#8b949e" },
  empty: { color: "#8b949e", padding: 20, textAlign: "center" as const },
  formCard: { background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: 24, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
  formGrid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 4 },
  formRow: { display: "flex", flexDirection: "column" as const, gap: 6 },
  label: { fontSize: 13, color: "#8b949e", fontWeight: 500 },
  input: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", color: "#e6edf3", fontSize: 14 },
  cancelBtn: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 },
  saveBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  removeBtn: { background: "none", border: "1px solid #cf222e", color: "#f85149", borderRadius: 5, padding: "6px 10px", cursor: "pointer", fontSize: 12 },
  addRowBtn: { background: "none", border: "1px dashed #30363d", color: "#8b949e", borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 12, marginTop: 4 },
  list: { display: "flex", flexDirection: "column" as const, gap: 8 },
  problemCard: { background: "#161b22", border: "1px solid #21262d", borderRadius: 8, overflow: "hidden" },
  problemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", cursor: "pointer", gap: 12 },
  problemLeft: { display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" as const },
  problemRight: { display: "flex", gap: 8, flexShrink: 0 },
  statusBadge: { display: "inline-block", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 },
  diffBadge: { background: "#21262d", color: "#8b949e", borderRadius: 10, padding: "2px 8px", fontSize: 11 },
  typeBadge: { background: "#0c1f40", color: "#58a6ff", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600 },
  problemTitle: { fontWeight: 600, fontSize: 14 },
  problemMeta: { display: "flex", gap: 12, alignItems: "center", flexShrink: 0 },
  metaText: { color: "#6e7681", fontSize: 12 },
  expandIcon: { color: "#6e7681", fontSize: 12 },
  problemBody: { padding: "0 16px 16px", borderTop: "1px solid #21262d" },
  problemDesc: { color: "#8b949e", fontSize: 13, lineHeight: 1.6, padding: "12px 0", whiteSpace: "pre-wrap" as const },
  testResultBox: { border: "1px solid", borderRadius: 6, padding: "10px 14px", marginBottom: 12 },
  pre: { background: "#0d1117", borderRadius: 4, padding: "8px 10px", fontSize: 12, color: "#e6edf3", overflow: "auto" as const, marginTop: 6 },
  problemActions: { display: "flex", gap: 8, flexWrap: "wrap" as const },
  testBtn: { background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  approveBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  archiveBtn: { background: "none", border: "1px solid #6e7681", color: "#8b949e", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  restoreBtn: { background: "none", border: "1px solid #f0c946", color: "#f0c946", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
};
