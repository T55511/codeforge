import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError("メールアドレスまたはパスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>⚡ CodeForge</h1>
        <p style={styles.subtitle}>AI駆動型プログラミング学習</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p style={styles.link}>
          アカウントをお持ちでない方は{" "}
          <a href="/register" style={{ color: "#58a6ff" }}>新規登録</a>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0d1117",
  },
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    padding: "48px 40px",
    width: "100%",
    maxWidth: 400,
    textAlign: "center" as const,
  },
  logo: {
    fontSize: 32,
    fontWeight: 700,
    color: "#58a6ff",
    marginBottom: 8,
  },
  subtitle: { color: "#8b949e", marginBottom: 32 },
  form: { display: "flex", flexDirection: "column" as const, gap: 16 },
  input: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 6,
    padding: "10px 14px",
    color: "#e6edf3",
    fontSize: 14,
  },
  error: { color: "#f85149", fontSize: 13 },
  button: {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "10px 0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  link: { marginTop: 24, color: "#8b949e", fontSize: 13 },
};
