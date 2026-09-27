// Before the tests: make the test account on the test house server, say
// the house phrase for it, and make it an admin (for the admin panel's tools).
import { HOUSE_PORT, TEST_HOUSE } from "./house.js";

export default async function globalSetup() {
  const base = `http://localhost:${HOUSE_PORT}`;
  const call = async (path, body, headers = {}) => {
    const res = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
    return data;
  };
  const { token } = await call("/api/signup", { name: TEST_HOUSE.name, password: TEST_HOUSE.password });
  await call("/api/join", { phrase: TEST_HOUSE.phrase }, { Authorization: `Bearer ${token}` });
  await call("/admin/promote", { name: TEST_HOUSE.name }, { "X-Admin-Token": TEST_HOUSE.adminToken });
}
