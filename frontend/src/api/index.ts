import api from "./client";
import type { Language, SkillTreeNode, DashboardData, TaskResult, User } from "../types";

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>("/auth/login", { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post("/auth/register", { name, email, password }),
  claimAdmin: () => api.post<User>("/auth/claim-admin"),
};

export const studentApi = {
  getLanguages: () => api.get<Language[]>("/languages"),
  getSkillTree: (languageId: string) =>
    api.get<SkillTreeNode[]>(`/skill-tree?language_id=${languageId}`),
  getDashboard: () => api.get<DashboardData>("/me/dashboard"),
  execute: (problemId: string, code: string, hintCount: number) =>
    api.post<{ task_id: string }>("/execute", {
      problem_id: problemId,
      code,
      hint_count: hintCount,
    }),
  pollTask: (taskId: string) => api.get<TaskResult>(`/tasks/${taskId}`),
  chat: (problemId: string, message: string, code: string, errorLog: string) =>
    api.post<{ reply: string; hints_remaining: number }>("/chat", {
      problem_id: problemId,
      message,
      code,
      error_log: errorLog,
    }),
  review: (problemId: string, code: string, submissionId: string) =>
    api.post<{ comments: Array<{ line: number; type: string; message: string }> }>("/review", {
      problem_id: problemId,
      code,
      submission_id: submissionId,
    }),
  giveup: (problemId: string, code: string, hintCount: number) =>
    api.post<{ explanation: string; key_concepts: string[]; hints_used: number }>("/giveup", {
      problem_id: problemId,
      code,
      hint_count: hintCount,
    }),
  getPoolStatus: () => api.get<Record<string, number>>("/sandbox/pool-status"),
  getNextProblem: (tagId: string) =>
    api.get<{ problem_id: string; title: string }>(`/problems/next?tag_id=${tagId}`),
};

export const adminApi = {
  getLanguages: () => api.get<Language[]>("/admin/languages"),
  createLanguage: (data: { name: string; version: string; icon_slug: string }) =>
    api.post("/admin/languages", data),
  updateLanguage: (id: string, data: Partial<Language>) =>
    api.patch(`/admin/languages/${id}`, data),
  getTags: (languageId: string) =>
    api.get(`/admin/tags?language_id=${languageId}`),
  createTag: (data: object) => api.post("/admin/tags", data),
  updateTag: (id: string, data: object) => api.patch(`/admin/tags/${id}`, data),
  deleteTag: (id: string) => api.delete(`/admin/tags/${id}`),
  createTagDependency: (data: object) => api.post("/admin/tag-dependencies", data),
  getProblems: (params: { language_id?: string; tag_id?: string; status?: string }) =>
    api.get("/admin/problems", { params }),
  createProblem: (data: object) => api.post("/admin/problems", data),
  updateProblem: (id: string, data: object) => api.patch(`/admin/problems/${id}`, data),
  testProblem: (id: string) => api.post(`/admin/problems/${id}/test`),
  generateProblems: (data: object) => api.post("/admin/problems/generate", data),
};
