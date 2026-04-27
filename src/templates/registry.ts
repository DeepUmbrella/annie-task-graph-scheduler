import type { TaskTemplate, TemplateRegistry } from "../models/template.js";

export function createTemplateRegistry(): TemplateRegistry {
  const templates = new Map<string, TaskTemplate>();

  return {
    register(template: TaskTemplate): void {
      templates.set(template.id, template);
    },

    get(id: string): TaskTemplate | undefined {
      return templates.get(id);
    },

    list(): TaskTemplate[] {
      return Array.from(templates.values()).sort((a, b) => a.id.localeCompare(b.id));
    },

    findByTag(tag: string): TaskTemplate[] {
      return Array.from(templates.values())
        .filter((t) => t.tags.includes(tag))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
  };
}
