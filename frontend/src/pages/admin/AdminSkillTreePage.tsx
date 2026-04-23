import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { adminApi } from "../../api";

const CATEGORIES = ["基礎", "データ構造", "アルゴリズム", "OOP", "テスト"];

interface Tag {
  id: string;
  name: string;
  category: string;
  max_level: number;
  sort_order: number;
  is_active: boolean;
  dependencies: Array<{ required_tag_id: string; required_level: number }>;
}

type TagForm = { name: string; category: string; max_level: string; sort_order: string };
type DepForm = { target_tag_id: string; required_tag_id: string; required_level: string };

const EMPTY_TAG: TagForm = { name: "", category: "基礎", max_level: "5", sort_order: "0" };
const EMPTY_DEP: DepForm = { target_tag_id: "", required_tag_id: "", required_level: "1" };

export default function AdminSkillTreePage() {
  const [params] = useSearchParams();
  const languageId = params.get("language_id") || "";
  const languageName = params.get("language_name") || "言語";

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [showDepForm, setShowDepForm] = useState(false);
  const [tagForm, setTagForm] = useState<TagForm>(EMPTY_TAG);
  const [depForm, setDepForm] = useState<DepForm>(EMPTY_DEP);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = () => {
    if (!languageId) return;
    setLoading(true);
    adminApi.getTags(languageId)
      .then((r) => setTags(r.data as Tag[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [languageId]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingTag) {
        await adminApi.updateTag(editingTag.id, {
          name: tagForm.name,
          category: tagForm.category,
          max_level: Number(tagForm.max_level),
          sort_order: Number(tagForm.sort_order),
        });
        flash("ok", "スキルを更新しました");
      } else {
        await adminApi.createTag({
          name: tagForm.name,
          category: tagForm.category,
          max_level: Number(tagForm.max_level),
          sort_order: Number(tagForm.sort_order),
          language_id: languageId,
        });
        flash("ok", "スキルを追加しました");
      }
      setTagForm(EMPTY_TAG);
      setEditingTag(null);
      setShowTagForm(false);
      load();
    } catch {
      flash("err", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`「${tag.name}」を削除しますか？`)) return;
    try {
      await adminApi.deleteTag(tag.id);
      flash("ok", "削除しました");
      load();
    } catch {
      flash("err", "削除に失敗しました");
    }
  };

  const handleToggleActive = async (tag: Tag) => {
    await adminApi.updateTag(tag.id, { is_active: !tag.is_active });
    load();
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setTagForm({
      name: tag.name,
      category: tag.category,
      max_level: String(tag.max_level),
      sort_order: String(tag.sort_order),
    });
    setShowTagForm(true);
    setShowDepForm(false);
  };

  const handleCreateDep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createTagDependency({
        target_tag_id: depForm.target_tag_id,
        required_tag_id: depForm.required_tag_id,
        required_level: Number(depForm.required_level),
      });
      flash("ok", "依存関係を追加しました");
      setDepForm(EMPTY_DEP);
      setShowDepForm(false);
      load();
    } catch {
      flash("err", "追加に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const tagById = (id: string) => tags.find((t) => t.id === id)?.name ?? id.slice(0, 8);

  return (
    <AdminLayout>
      <div style={styles.header}>
        <h1 style={styles.title}>🌲 スキルツリー管理 — {languageName}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.depBtn} onClick={() => { setShowDepForm(true); setShowTagForm(false); }}>
            + 依存関係を追加
          </button>
          <button style={styles.addBtn} onClick={() => { setShowTagForm(true); setShowDepForm(false); setEditingTag(null); setTagForm(EMPTY_TAG); }}>
            + スキルを追加
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ ...styles.flash, ...(msg.type === "ok" ? styles.flashOk : styles.flashErr) }}>
          {msg.text}
        </div>
      )}

      {!languageId && (
        <p style={styles.noLang}>言語管理ページから「ツリー編集」ボタンで遷移してください。</p>
      )}

      {/* スキル追加・編集フォーム */}
      {showTagForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>{editingTag ? "スキルを編集" : "スキルを追加"}</h2>
          <form onSubmit={handleCreateTag} style={styles.formGrid}>
            <div style={styles.formRow}>
              <label style={styles.label}>スキル名</label>
              <input style={styles.input} value={tagForm.name} onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })} required placeholder="例: 変数と型" />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>カテゴリ</label>
              <select style={styles.select} value={tagForm.category} onChange={(e) => setTagForm({ ...tagForm, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>最大レベル</label>
              <input style={styles.input} type="number" min="1" max="10" value={tagForm.max_level} onChange={(e) => setTagForm({ ...tagForm, max_level: e.target.value })} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>表示順</label>
              <input style={styles.input} type="number" value={tagForm.sort_order} onChange={(e) => setTagForm({ ...tagForm, sort_order: e.target.value })} />
            </div>
            <div style={{ ...styles.formRow, gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" style={styles.cancelBtn} onClick={() => { setShowTagForm(false); setEditingTag(null); }}>キャンセル</button>
                <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? "保存中..." : editingTag ? "更新する" : "追加する"}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 依存関係追加フォーム */}
      {showDepForm && (
        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>依存関係（解放条件）を追加</h2>
          <p style={styles.depHelp}>「前提スキル が 必要レベル に達したとき、解放スキル がアンロックされる」という関係を設定します。</p>
          <form onSubmit={handleCreateDep} style={styles.formGrid}>
            <div style={styles.formRow}>
              <label style={styles.label}>解放されるスキル</label>
              <select style={styles.select} value={depForm.target_tag_id} onChange={(e) => setDepForm({ ...depForm, target_tag_id: e.target.value })} required>
                <option value="">選択してください</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>前提スキル</label>
              <select style={styles.select} value={depForm.required_tag_id} onChange={(e) => setDepForm({ ...depForm, required_tag_id: e.target.value })} required>
                <option value="">選択してください</option>
                {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>必要レベル</label>
              <input style={styles.input} type="number" min="1" max="10" value={depForm.required_level} onChange={(e) => setDepForm({ ...depForm, required_level: e.target.value })} />
            </div>
            <div style={{ ...styles.formRow, gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowDepForm(false)}>キャンセル</button>
                <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? "追加中..." : "追加する"}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* スキル一覧 */}
      {loading ? (
        <p style={styles.loading}>読み込み中...</p>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ flex: 1 }}>スキル名</span>
            <span style={{ flex: "0 0 100px" }}>カテゴリ</span>
            <span style={{ flex: "0 0 70px", textAlign: "center" as const }}>最大Lv</span>
            <span style={{ flex: "0 0 70px", textAlign: "center" as const }}>順序</span>
            <span style={{ flex: 1 }}>前提条件</span>
            <span style={{ flex: "0 0 80px", textAlign: "center" as const }}>状態</span>
            <span style={{ flex: "0 0 140px" }}>操作</span>
          </div>
          {tags.map((tag) => (
            <div key={tag.id} style={{ ...styles.tableRow, opacity: tag.is_active ? 1 : 0.5 }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{tag.name}</span>
              <span style={{ flex: "0 0 100px" }}>
                <span style={{ ...styles.catBadge, background: CAT_COLORS[tag.category] ?? "#21262d" }}>
                  {tag.category}
                </span>
              </span>
              <span style={{ flex: "0 0 70px", textAlign: "center" as const, color: "#8b949e" }}>{tag.max_level}</span>
              <span style={{ flex: "0 0 70px", textAlign: "center" as const, color: "#8b949e" }}>{tag.sort_order}</span>
              <span style={{ flex: 1, fontSize: 12, color: "#8b949e" }}>
                {tag.dependencies?.length > 0
                  ? tag.dependencies.map((d) => `${tagById(d.required_tag_id)} Lv.${d.required_level}`).join(", ")
                  : <span style={{ color: "#3fb950" }}>なし（最初から解放）</span>}
              </span>
              <span style={{ flex: "0 0 80px", textAlign: "center" as const }}>
                <span style={{ ...styles.badge, ...(tag.is_active ? styles.badgeActive : styles.badgeInactive) }}>
                  {tag.is_active ? "有効" : "無効"}
                </span>
              </span>
              <div style={{ flex: "0 0 140px", display: "flex", gap: 6 }}>
                <button style={styles.editBtn} onClick={() => handleEditTag(tag)}>編集</button>
                <button style={tag.is_active ? styles.deactivateBtn : styles.activateBtn} onClick={() => handleToggleActive(tag)}>
                  {tag.is_active ? "無効化" : "有効化"}
                </button>
                <button style={styles.deleteBtn} onClick={() => handleDeleteTag(tag)}>削除</button>
              </div>
            </div>
          ))}
          {tags.length === 0 && languageId && (
            <p style={styles.empty}>スキルがありません。「+ スキルを追加」から追加してください。</p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

const CAT_COLORS: Record<string, string> = {
  "基礎": "#0f2d16",
  "データ構造": "#0c1f40",
  "アルゴリズム": "#2d1f00",
  "OOP": "#1f0a3a",
  "テスト": "#3a0a0a",
};

const styles: Record<string, React.CSSProperties> = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700 },
  addBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  depBtn: { background: "#1f6feb", color: "#fff", border: "none", borderRadius: 6, padding: "8px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  noLang: { color: "#f0c946", background: "#2d2200", border: "1px solid #9a6700", borderRadius: 8, padding: "12px 16px" },
  flash: { borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 14 },
  flashOk: { background: "#1a3d25", color: "#3fb950", border: "1px solid #238636" },
  flashErr: { background: "#3a0a0a", color: "#f85149", border: "1px solid #cf222e" },
  loading: { color: "#8b949e" },
  empty: { color: "#8b949e", padding: 20, textAlign: "center" as const },
  formCard: { background: "#161b22", border: "1px solid #21262d", borderRadius: 10, padding: 24, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  depHelp: { color: "#8b949e", fontSize: 13, marginBottom: 16 },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  formRow: { display: "flex", flexDirection: "column" as const, gap: 6 },
  label: { fontSize: 13, color: "#8b949e", fontWeight: 500 },
  input: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", color: "#e6edf3", fontSize: 14 },
  select: { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: "8px 12px", color: "#e6edf3", fontSize: 14 },
  cancelBtn: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontSize: 13 },
  saveBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 6, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  table: { background: "#161b22", border: "1px solid #21262d", borderRadius: 10, overflow: "hidden" },
  tableHeader: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 16px", background: "#0d1117",
    fontSize: 11, fontWeight: 600, color: "#8b949e",
    textTransform: "uppercase" as const, letterSpacing: 0.5,
    borderBottom: "1px solid #21262d",
  },
  tableRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", borderBottom: "1px solid #21262d", fontSize: 13,
  },
  catBadge: { display: "inline-block", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#c9d1d9" },
  badge: { display: "inline-block", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 600 },
  badgeActive: { background: "#1a3d25", color: "#3fb950" },
  badgeInactive: { background: "#2d1b00", color: "#9a6700" },
  editBtn: { background: "#21262d", border: "1px solid #30363d", color: "#c9d1d9", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11 },
  activateBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 },
  deactivateBtn: { background: "none", border: "1px solid #6e7681", color: "#8b949e", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11 },
  deleteBtn: { background: "none", border: "1px solid #cf222e", color: "#f85149", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 11 },
};
