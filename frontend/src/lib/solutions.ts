// Shared with the edit form so read-only views follow its standard item order.
export const solutionOptions = [["sms", "SMS"], ["nms", "NMS"], ["dbms", "DBMS"], ["apm", "APM"], ["syslog", "SYSLOG"], ["trap", "TRAP"], ["oz", "OZ 보고서"]] as const;

export function orderedSolutions(rows: Record<string, unknown>[] = []) {
  const rank = (row: Record<string, unknown>) => {
    const index = solutionOptions.findIndex(([code]) => code === String(row.category ?? "").toLowerCase());
    return index < 0 ? solutionOptions.length : index;
  };
  // Stable sort leaves custom items in the same order as the edit form.
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

export function solutionSummary(rows: Record<string, unknown>[] = []) {
  const text = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim() || "-";
  return orderedSolutions(rows).map(row => {
    const name = row.product_name || solutionOptions.find(([code]) => code === row.category)?.[1] || row.category || "기타";
    return `${text(name)}(${text(row.used_quantity)}/${text(row.total_quantity)}):${text(row.other_detail)}/${text(row.additional_info)}`;
  }).join("\n");
}
