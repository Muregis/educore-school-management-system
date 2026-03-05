export const money = v => `KSh ${Number(v || 0).toLocaleString()}`;
export const genId = () => Date.now() + Math.floor(Math.random() * 10000);
