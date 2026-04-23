import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { studentApi } from "./api";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import SkillTreePage from "./pages/SkillTreePage";
import WorkspacePage from "./pages/WorkspacePage";
import AdminLanguagesPage from "./pages/admin/AdminLanguagesPage";
import AdminSkillTreePage from "./pages/admin/AdminSkillTreePage";
import AdminProblemsPage from "./pages/admin/AdminProblemsPage";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    studentApi.getDashboard()
      .then((r) => setIsAdmin(r.data.user.is_admin))
      .catch(() => setIsAdmin(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin === null) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/skill-tree/:languageId"
          element={
            <PrivateRoute>
              <SkillTreePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/workspace/:problemId"
          element={
            <PrivateRoute>
              <WorkspacePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/languages"
          element={
            <AdminRoute>
              <AdminLanguagesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/skill-tree"
          element={
            <AdminRoute>
              <AdminSkillTreePage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/problems"
          element={
            <AdminRoute>
              <AdminProblemsPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
