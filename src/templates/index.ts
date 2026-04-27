import type { TaskTemplate } from "../models/template.js";
import { createTemplateRegistry } from "./registry.js";
import { apiDesignImplementTest } from "./builtins/api_design_implement_test.js";
import { parallelFrontendBackend } from "./builtins/parallel_frontend_backend.js";
import { fullStackReview } from "./builtins/full_stack_review.js";

export { createTemplateRegistry } from "./registry.js";
export { apiDesignImplementTest } from "./builtins/api_design_implement_test.js";
export { parallelFrontendBackend } from "./builtins/parallel_frontend_backend.js";
export { fullStackReview } from "./builtins/full_stack_review.js";

export const builtinTemplates: TaskTemplate[] = [
  apiDesignImplementTest,
  parallelFrontendBackend,
  fullStackReview
];

export function createBuiltinRegistry() {
  const registry = createTemplateRegistry();
  for (const template of builtinTemplates) {
    registry.register(template);
  }
  return registry;
}
