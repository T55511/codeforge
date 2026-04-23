import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { studentApi } from "../api";
import type { SkillTreeNode } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  "基礎": "#238636",
  "データ構造": "#1f6feb",
  "アルゴリズム": "#9a6700",
  "OOP": "#8957e5",
  "テスト": "#cf222e",
};

export default function SkillTreePage() {
  const { languageId } = useParams<{ languageId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<SkillTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("すべて");
  const [nodeError, setNodeError] = useState<string>("");

  const handleNodeSelect = async (tagId: string) => {
    setNodeError("");
    try {
      const res = await studentApi.getNextProblem(tagId);
      navigate(`/workspace/${res.data.problem_id}`);
    } catch {
      setNodeError("このスキルにはまだ問題がありません");
      setTimeout(() => setNodeError(""), 3000);
    }
  };

  useEffect(() => {
    if (!languageId) return;
    studentApi.getSkillTree(languageId)
      .then((res) => setNodes(res.data))
      .finally(() => setLoading(false));
  }, [languageId]);

  const categories = ["すべて", ...Array.from(new Set(nodes.map((n) => n.category)))];
  const filtered = selectedCategory === "すべて"
    ? nodes
    : nodes.filter((n) => n.category === selectedCategory);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.back} onClick={() => navigate("/")}>← ダッシュボード</button>
        <h1 style={styles.title}>スキルツリー</h1>
      </header>
      {nodeError && <div style={styles.errorBanner}>{nodeError}</div>}

      <div style={styles.filterRow}>
        {categories.map((cat) => (
          <button
            key={cat}
            style={{
              ...styles.filterBtn,
              ...(selectedCategory === cat ? styles.filterBtnActive : {}),
            }}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={styles.grid}>
        {filtered.map((node) => (
          <SkillNode key={node.id} node={node} onSelect={() => handleNodeSelect(node.id)} />
        ))}
      </div>
    </div>
  );
}

function SkillNode({ node, onSelect }: { node: SkillTreeNode; onSelect: () => void }) {
  const color = CATEGORY_COLORS[node.category] || "#444";
  const opacity = node.is_unlocked ? 1 : 0.4;

  return (
    <div
      style={{ ...styles.node, opacity, borderColor: color, cursor: node.is_unlocked ? "pointer" : "not-allowed" }}
      onClick={node.is_unlocked ? onSelect : undefined}
    >
      <div style={{ ...styles.categoryBadge, background: color }}>{node.category}</div>
      <div style={styles.nodeName}>{node.name}</div>
      <div style={styles.levelBar}>
        {Array.from({ length: node.max_level }).map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.levelDot,
              background: i < node.current_level ? "#f0c946" : "#21262d",
            }}
          />
        ))}
      </div>
      <div style={styles.nodeFooter}>
        <span style={styles.level}>Lv.{node.current_level}/{node.max_level}</span>
        {!node.is_unlocked && <span style={styles.locked}>🔒</span>}
        {node.is_unlocked && node.current_level === node.max_level && <span style={styles.complete}>✓</span>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: "#8b949e", textAlign: "center", padding: 80 },
  errorBanner: { background: "#3d1a1a", color: "#f85149", padding: "10px 32px", fontSize: 14 },
  container: { minHeight: "100vh", background: "#0d1117", padding: "0 0 40px" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "16px 32px",
    borderBottom: "1px solid #21262d",
    background: "#161b22",
  },
  back: { background: "none", border: "1px solid #30363d", color: "#8b949e", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13 },
  title: { fontSize: 20, fontWeight: 700 },
  filterRow: { display: "flex", gap: 8, padding: "20px 32px", flexWrap: "wrap" as const },
  filterBtn: { background: "#21262d", border: "1px solid #30363d", color: "#8b949e", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 13 },
  filterBtnActive: { background: "#1f6feb", borderColor: "#1f6feb", color: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, padding: "0 32px" },
  node: {
    background: "#161b22",
    border: "2px solid",
    borderRadius: 10,
    padding: "16px 14px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 10,
  },
  categoryBadge: { display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600, color: "#fff", width: "fit-content" },
  nodeName: { fontWeight: 600, fontSize: 15 },
  levelBar: { display: "flex", gap: 4 },
  levelDot: { width: 10, height: 10, borderRadius: "50%" },
  nodeFooter: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  level: { color: "#8b949e", fontSize: 12 },
  locked: { fontSize: 14 },
  complete: { color: "#3fb950", fontWeight: 700 },
};
