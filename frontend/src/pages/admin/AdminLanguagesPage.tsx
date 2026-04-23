import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { adminApi } from "../../api";
import type { Language } from "../../types";

type FormState = { name: string; version: string; icon_slug: string; sort_order: string };
const EMPTY_FORM: FormState = { name: "", version: "", icon_slug: "", sort_order: "0" };

export default function AdminLanguagesPage() {
  const navigate = useNavigate();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    adminApi.getLanguages().then((r) => setLanguages(r.data)).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleToggle = async (lang: Language) => {
    await adminApi.updateLanguage(lang.id, { is_active: !lang.is_active });
    load();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await adminApi.createLanguage({
        name: form.name,
        version: form.version,
        icon_slug: form.icon_slug,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || "作成に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div style={styles.header}>
        <h1 style={styles.title}>🌐 言語管理</h1>
        <button style={styles.addBtn} onClick={() => setShowForm(true)}>
          + 言語を追加
        </button>
      </div>

      {showForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>新しい言語を追加</h2>
          <form onSubmit={handleCreate} style={styles.form}>
            <div style={styles.formRow}>
              <label style={styles.label}>言語名</label>
              <input
                style={styles.input}
                placeholder="例: Python"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>バージョン</label>
              <input
                style={styles.input}
                placeholder="例: 3.11"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                required
              />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>アイコン略称</label>
              <input
                style={styles.input}
                placeholder="例: Py"
                value={form.icon_slug}
                onChange={(e) => setForm({ ...form, icon_slug: e.target.value })}
                required
              />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.formActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setError(""); }}>
                キャンセル
              </button>
              <button type="submit" style={styles.saveBtn} disabled={saving}>
                {saving ? "追加中..." : "追加する"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p style={styles.loading}>読み込み中...</p>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: "0 0 60px" }}>アイコン</span>
            <span style={{ flex: 1 }}>言語名</span>
            <span style={{ flex: "0 0 100px" }}>バージョン</span>
            <span style={{ flex: "0 0 100px" }}>ステータス</span>
            <span style={{ flex: "0 0 160px" }}>操作</span>
          </div>
          {languages.map((lang) => (
            <div key={lang.id} style={styles.tableRow}>
              <span style={{ ...styles.iconCell, flex: "0 0 60px" }}>{lang.icon_slug}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{lang.name}</span>
              <span style={{ flex: "0 0 100px", color: "#8b949e" }}>v{lang.version}</span>
              <span style={{ flex: "0 0 100px" }}>
                <span style={{ ...styles.badge, ...(lang.is_active ? styles.badgeActive : styles.badgeInactive) }}>
                  {lang.is_active ? "有効" : "無効"}
                </span>
              </span>
              <div style={{ flex: "0 0 160px", display: "flex", gap: 8 }}>
                <button
                  style={lang.is_active ? styles.deactivateBtn : styles.activateBtn}
                  onClick={() => handleToggle(lang)}
                >
                  {lang.is_active ? "無効化" : "有効化"}
                </button>
                <button
                  style={styles.treeBtn}
                  onClick={() => navigate(`/admin/skill-tree?language_id=${lang.id}&language_name=${encodeURIComponent(lang.name)}`)}
                >
                  ツリー編集
                </button>
              </div>
            </div>
          ))}
          {languages.length === 0 && (
            <p style={styles.empty}>言語が登録されていません。「+ 言語を追加」から追加してください。</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700 },
  addBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  loading: { color: "#8b949e" },
  empty: { color: "#8b949e", padding: 20, textAlign: "center" as const },
  formCard: { background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: 24, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
  form: { display: "flex", flexDirection: "column" as const, gap: 14 },
  formRow: { display: "flex", flexDirection: "column" as const, gap: 6 },
  label: { fontSize: 13, color: "#8b949e", fontWeight: 500 },
  input: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", color: "#e6edf3", fontSize: 14 },
  error: { color: "#f85149", fontSize: 13 },
  formActions: { display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 },
  cancelBtn: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 },
  saveBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  table: { background: "#161b22", border: "1px solid #21262d", borderRadius: 10, overflow: "hidden" },
  tableHeader: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "10px 20px",
    background: "#0d1117",
    fontSize: 12, fontWeight: 600, color: "#8b949e",
    textTransform: "uppercase" as const, letterSpacing: 0.5,
    borderBottom: "1px solid #21262d",
  },
  tableRow: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "14px 20px",
    borderBottom: "1px solid #21262d",
    fontSize: 14,
  },
  iconCell: { fontWeight: 700, fontSize: 18, color: "#58a6ff" },
  badge: { display: "inline-block", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 600 },
  badgeActive: { background: "#1a3d25", color: "#3fb950" },
  badgeInactive: { background: "#2d1b00", color: "#9a6700" },
  activateBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  deactivateBtn: { background: "none", border: "1px solid #6e7681", color: "#8b949e", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 12 },
  treeBtn: { background: "#1f6feb", color: "#fff", border: "none", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 },
};
