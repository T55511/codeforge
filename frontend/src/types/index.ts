export interface Language {
  id: string;
  name: string;
  version: string;
  icon_slug: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TagDependency {
  required_tag_id: string;
  required_level: number;
}

export interface SkillTreeNode {
  id: string;
  language_id: string;
  template_id: string | null;
  name: string;
  category: string;
  max_level: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  dependencies: TagDependency[];
  current_level: number;
  current_exp: number;
  is_unlocked: boolean;
}

export interface Problem {
  id: string;
  language_id: string;
  tag_id: string;
  title: string;
  description: string;
  initial_code: string;
  judgment_type: string;
  test_cases: Array<{ input: string; expected_output: string }> | null;
  expected_output: string | null;
  difficulty: number;
  status: string;
  source: string;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  rank: string;
  total_exp: number;
  streak_days: number;
  is_admin: boolean;
  created_at: string;
}

export interface DashboardData {
  user: User;
  weekly_accuracy: number;
  recent_error_summary: string;
  next_problem_id: string | null;
  next_problem_title: string | null;
}

export interface TaskResult {
  task_id: string;
  status: "PENDING" | "STARTED" | "COMPLETED" | "FAILED";
  verdict: "PASS" | "FAIL" | "ERROR" | "TIMEOUT" | null;
  stdout: string | null;
  diff: string | null;
  failed_case: {
    case_index: number;
    input: string;
    expected: string;
    actual: string;
  } | null;
  error: {
    error_type: string;
    message_ja: string;
    line_number: number | null;
    detail: string;
  } | null;
  exp_breakdown: {
    base: number;
    first_try: number;
    no_hint: number;
    clean_code: number;
    efficient: number;
    total: number;
  } | null;
  exp_earned: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GiveupResult {
  explanation: string;
  key_concepts: string[];
  hints_used: number;
}
