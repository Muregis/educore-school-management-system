export const formatMoney = v => {
  if (v == null) return "";
  return `KSh ${Number(v).toLocaleString()}`;
};

export const formatDate = d => {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0];
};
