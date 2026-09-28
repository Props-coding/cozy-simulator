// Shared settings for the automated tests: where the test site and the
// test house server run, and the test account. All made up, and only
// used on this computer (or GitHub's test machine).
export const SITE_PORT = Number(process.env.SITE_PORT || 4173);
export const HOUSE_PORT = Number(process.env.HOUSE_PORT || 3999);
export const TEST_HOUSE = {
  phrase: "test house phrase",
  adminToken: "test-admin-token",
  name: "Tester",
  password: "testpass123",
};
