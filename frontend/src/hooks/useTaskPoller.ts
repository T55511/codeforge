import { useState, useEffect, useRef } from "react";
import { studentApi } from "../api";
import type { TaskResult } from "../types";

const POLL_INTERVAL = 500;
const MAX_POLLS = 20; // 最大10秒

export function useTaskPoller(taskId: string | null) {
  const [result, setResult] = useState<TaskResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollCount = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!taskId) return;

    setIsPolling(true);
    pollCount.current = 0;

    timer.current = setInterval(async () => {
      try {
        const res = await studentApi.pollTask(taskId);
        pollCount.current++;

        if (res.data.status === "COMPLETED" || res.data.status === "FAILED") {
          setResult(res.data);
          setIsPolling(false);
          clearInterval(timer.current!);
        } else if (pollCount.current >= MAX_POLLS) {
          setResult({ task_id: taskId, status: "FAILED", verdict: "TIMEOUT", stdout: null, diff: null, failed_case: null, error: { error_type: "TIMEOUT", message_ja: "処理時間が超過しました。無限ループの可能性があります。", line_number: null, detail: "" }, exp_breakdown: null, exp_earned: 0 });
          setIsPolling(false);
          clearInterval(timer.current!);
        }
      } catch {
        setIsPolling(false);
        clearInterval(timer.current!);
      }
    }, POLL_INTERVAL);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [taskId]);

  return { result, isPolling };
}
