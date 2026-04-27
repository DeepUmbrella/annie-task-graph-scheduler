import type { TaskTemplate } from "../../models/template.js";

export const apiDesignImplementTest: TaskTemplate = {
  id: "api-design-implement-test",
  name: "API Design → Implement → Test",
  description: "Sequential workflow: design API, implement service, write tests, update docs.",
  tasks: [
    { id: "T1", title: "Design API", risk: "low" },
    { id: "T2", title: "Implement service", depends_on: ["T1"], risk: "medium" },
    { id: "T3", title: "Write tests", depends_on: ["T2"], risk: "medium" },
    { id: "T4", title: "Update docs", depends_on: ["T3"], risk: "low" }
  ],
  execution_policy: {},
  tags: ["api", "sequential", "backend"],
  version: 1,
  created_at: "2026-04-27T00:00:00.000Z"
};
