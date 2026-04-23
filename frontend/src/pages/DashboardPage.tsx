import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { studentApi } from "../api";
import { useAuthContext } from "../context/AuthContext";
import type { DashboardData, Language } from "../types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([studentApi.getDashboard(), studentApi.getLanguages()])
      .then(([dashRes, langRes]) => {
        setDashboard(dashRes.data);
        setLanguages(langRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;
  if (!dashboard) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>⚡ CodeForge</h1>
        <div style={styles.userInfo}>
          <span style={styles.rank}>{dashboard.user.rank}</span>
          <span style={styles.exp}>{dashboard.user.total_exp} EXP</span>
          <span style={styles.streak}>🔥 {dashboard.user.streak_days}日</span>
          {isAdmin && (
            <button style={styles.adminBtn} onClick={() => navigate("/admin/languages")}>
              ⚙ 管理者画面
            </button>
          )}
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{dashboard.weekly_accuracy}%</div>
            <div style={styles.statLabel}>週間正答率</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{dashboard.user.streak_days}</div>
            <div style={styles.statLabel}>連続学習日数</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{dashboard.user.total_exp}</div>
            <div style={styles.statLabel}>累計EXP</div>
          </div>
        </section>

        {dashboard.next_problem_id && (
          <section style={styles.quickStart}>
            <h2 style={styles.sectionTitle}>次の1問</h2>
            <div style={styles.nextProblemCard}>
              <p style={styles.nextProblemTitle}>{dashboard.next_problem_title}</p>
              <button
                style={styles.startButton}
                onClick={() => navigate(`/workspace/${dashboard.next_problem_id}`)}
              >
                今すぐ解く →
              </button>
            </div>
          </section>
        )}

        <section style={styles.languageSection}>
          <h2 style={styles.sectionTitle}>学習言語</h2>
          <div style={styles.languageGrid}>
            {languages.map((lang) => (
              <div
                key={lang.id}
                style={styles.languageCard}
                onClick={() => navigate(`/skill-tree/${lang.id}`)}
              >
                <div style={styles.langIcon}>{lang.icon_slug}</div>
                <div style={styles.langName}>{lang.name}</div>
                <div style={styles.langVersion}>v{lang.version}</div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: "#8b949e", textAlign: "center", padding: 80 },
  container: { minHeight: "100vh", background: "#0d1117" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: "1px solid #21262d",
    background: "#161b22",
  },
  logo: { fontSize: 22, fontWeight: 700, color: "#58a6ff" },
  userInfo: { display: "flex", gap: 16, alignItems: "center" },
  rank: { background: "#1f6feb", color: "#fff", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  exp: { color: "#f0c946", fontWeight: 600 },
  streak: { color: "#ff6e40", fontWeight: 600 },
  adminBtn: { background: "#6e40c9", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  main: { maxWidth: 1000, margin: "0 auto", padding: "40px 24px" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 40 },
  statCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 10,
    padding: "24px 20px",
    textAlign: "center" as const,
  },
  statValue: { fontSize: 36, fontWeight: 700, color: "#58a6ff" },
  statLabel: { color: "#8b949e", marginTop: 6, fontSize: 14 },
  quickStart: { marginBottom: 40 },
  sectionTitle: { fontSize: 18, fontWeight: 600, marginBottom: 16, color: "#e6edf3" },
  nextProblemCard: {
    background: "#161b22",
    border: "1px solid #238636",
    borderRadius: 10,
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextProblemTitle: { fontSize: 16, color: "#e6edf3" },
  startButton: {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  languageSection: {},
  languageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 },
  languageCard: {
    background: "#161b22",
    border: "1px solid #21262d",
    borderRadius: 10,
    padding: "20px 16px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "border-color 0.2s",
  },
  langIcon: { fontSize: 28, fontWeight: 700, color: "#58a6ff", marginBottom: 8 },
  langName: { fontWeight: 600, fontSize: 15, marginBottom: 4 },
  langVersion: { color: "#8b949e", fontSize: 12 },
};
