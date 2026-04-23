import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

interface Stats {
  user_count: number;
  problem_count: number;
  tag_count: number;
  approved_count: number;
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats")
      .then((r) => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>← 生徒画面へ</button>
          <h1 style={styles.title}>⚙ 管理者ダッシュボード</h1>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.statsGrid}>
          <StatCard label="ユーザー数" value={loading ? "…" : stats?.user_count ?? 0} color="#58a6ff" />
          <StatCard label="問題数（全体）" value={loading ? "…" : stats?.problem_count ?? 0} color="#8957e5" />
          <StatCard label="承認済み問題" value={loading ? "…" : stats?.approved_count ?? 0} color="#3fb950" />
          <StatCard label="スキルタグ数" value={loading ? "…" : stats?.tag_count ?? 0} color="#f0c946" />
        </section>

        <h2 style={styles.sectionTitle}>管理メニュー</h2>
        <div style={styles.menuGrid}>
          <MenuCard
            emoji="🌐"
            title="言語管理"
            description="プログラミング言語の追加・有効化・無効化"
            onClick={() => navigate("/admin/languages")}
          />
          <MenuCard
            emoji="🌲"
            title="スキルツリー"
            description="スキルタグの作成・依存関係の設定"
            onClick={() => navigate("/admin/skill-tree")}
          />
          <MenuCard
            emoji="📝"
            title="問題管理"
            description="問題の承認・アーカイブ・テスト実行・AI生成"
            onClick={() => navigate("/admin/problems")}
          />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function MenuCard({ emoji, title, description, onClick }: {
  emoji: string; title: string; description: string; onClick: () => void;
}) {
  return (
    <div style={styles.menuCard} onClick={onClick}>
      <div style={styles.menuEmoji}>{emoji}</div>
      <div style={styles.menuTitle}>{title}</div>
      <div style={styles.menuDesc}>{description}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", background: "#0d1117", color: "#e6edf3" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 32px", borderBottom: "1px solid #21262d", background: "#161b22",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 16 },
  backBtn: {
    background: "none", border: "1px solid #30363d", color: "#8b949e",
    borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13,
  },
  title: { fontSize: 20, fontWeight: 700 },
  main: { maxWidth: 1000, margin: "0 auto", padding: "40px 24px" },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 48,
  },
  statCard: {
    background: "#161b22", border: "1px solid #21262d", borderRadius: 10,
    padding: "24px 20px", textAlign: "center" as const,
  },
  statValue: { fontSize: 40, fontWeight: 700, marginBottom: 8 },
  statLabel: { color: "#8b949e", fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: "#8b949e", marginBottom: 16 },
  menuGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 },
  menuCard: {
    background: "#161b22", border: "1px solid #21262d", borderRadius: 12,
    padding: "28px 24px", cursor: "pointer",
    transition: "border-color 0.15s",
  },
  menuEmoji: { fontSize: 32, marginBottom: 12 },
  menuTitle: { fontWeight: 700, fontSize: 16, marginBottom: 8 },
  menuDesc: { color: "#8b949e", fontSize: 13, lineHeight: 1.5 },
};
