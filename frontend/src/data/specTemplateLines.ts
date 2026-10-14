/** Строки шаблона спецификации дома: учёт в общей сумме только при включённой галочке. */
export const OPTIONAL_TOTAL_TEMPLATE_LINES = new Set([19, 20, 21, 22])

export function isOptionalTotalTemplateLine(templateLineNo: number | null | undefined): boolean {
  return templateLineNo != null && OPTIONAL_TOTAL_TEMPLATE_LINES.has(templateLineNo)
}
