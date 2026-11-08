export const deliveryFields = [
  ["supplied_server", "Server 납품"],
  ["supplied_os", "OS 납품"],
  ["supplied_db", "DB 납품"],
] as const;

export type SiteDeliveries = Partial<Record<(typeof deliveryFields)[number][0], boolean>>;

export function deliveryFormValues(form: FormData) {
  return Object.fromEntries(deliveryFields.map(([key]) => [key, form.get(key) === "on"]));
}

export function checkedDeliveries(site: SiteDeliveries) {
  return deliveryFields.filter(([key]) => site[key]).map(([, label]) => label);
}
