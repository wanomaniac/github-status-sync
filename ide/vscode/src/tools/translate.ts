export function format(template: string, values: Record<string, any>) {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => values[key] ?? "");
}