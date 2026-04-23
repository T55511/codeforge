import { NavLink, useNavigate } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/admin/languages", label: "🌐 言語管理" },
  { to: "/admin/skill-tree", label: "🌲 スキルツリー" },
  { to: "/admin/problems", label: "📝 問題管理" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <span style={styles.logo}>⚡ CodeForge</span>
          <span style={styles.adminBadge}>管理者</span>
        </div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={styles.sidebarFooter}>
          <button style={styles.backBtn} onClick={() => navigate("/")}>
            ← 生徒画面へ
          </button>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", minHeight: "100vh", background: "#0d1117" },
  sidebar: {
    width: 220,
    background: "#161b22",
    borderRight: "1px solid #21262d",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  logoArea: {
    padding: "20px 16px 16px",
    borderBottom: "1px solid #21262d",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logo: { fontWeight: 700, fontSize: 17, color: "#58a6ff" },
  adminBadge: {
    background: "#6e40c9",
    color: "#fff",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 10,
  },
  nav: { padding: "12px 8px", display: "flex", flexDirection: "column", gap: 4, flex: 1 },
  navLink: {
    display: "block",
    padding: "9px 12px",
    borderRadius: 6,
    color: "#8b949e",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: 500,
  },
  navLinkActive: { background: "#1f3a5f", color: "#58a6ff" },
  sidebarFooter: { padding: 12, borderTop: "1px solid #21262d" },
  backBtn: {
    width: "100%",
    background: "none",
    border: "1px solid #30363d",
    color: "#8b949e",
    borderRadius: 6,
    padding: "7px 0",
    cursor: "pointer",
    fontSize: 13,
  },
  main: { flex: 1, overflow: "auto", padding: 32 },
};
