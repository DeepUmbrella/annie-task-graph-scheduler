import type { TaskTemplate } from "../../models/template.js";

export const parallelFrontendBackend: TaskTemplate = {
  id: "parallel-frontend-backend",
  name: "Parallel Frontend & Backend → Integration",
  description: "Design API then implement frontend and backend in parallel, followed by integration test.",
  tasks: [
    { id: "T1", title: "Design API", risk: "low" },
    { id: "T2", title: "Implement backend", depends_on: ["T1"], risk: "medium" },
    { id: "T3", title: "Implement frontend", depends_on: ["T1"], risk: "medium" },
    { id: "T4", title: "Integration test", depends_on: ["T2", "T3"], risk: "high" },
    { id: "T5", title: "Update docs", depends_on: ["T4"], risk: "low" }
  ],
  execution_policy: {},
  tags: ["api", "parallel", "fullstack"],
  version: 1,
  created_at: "2026-04-27T00:00:00.000Z"
};
