import type { TaskTemplate } from "../../models/template.js";

export const fullStackReview: TaskTemplate = {
  id: "full-stack-review",
  name: "Full Stack with Review Gate",
  description: "Design then parallel frontend/backend/docs, integration test, and final review.",
  tasks: [
    { id: "T1", title: "Design API", risk: "low" },
    { id: "T2", title: "Implement backend", depends_on: ["T1"], risk: "medium" },
    { id: "T3", title: "Implement frontend", depends_on: ["T1"], risk: "medium" },
    { id: "T4", title: "Write docs", depends_on: ["T1"], risk: "low" },
    { id: "T5", title: "Integration test", depends_on: ["T2", "T3"], risk: "high" },
    { id: "T6", title: "Final review", depends_on: ["T5", "T4"], risk: "critical" }
  ],
  execution_policy: {},
  tags: ["api", "parallel", "fullstack", "review"],
  version: 1,
  created_at: "2026-04-27T00:00:00.000Z"
};
