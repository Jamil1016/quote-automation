import { test, expect } from "@playwright/test";
import { collapsePresence, type PresenceMeta } from "./collapse";

const meta = (
  o: { email: string; page: string; online_at: string; idle?: boolean },
): PresenceMeta => ({ name: o.email.split("@")[0], idle: false, ...o });

test("page follows the most recent active tab when a person has multiple connections", () => {
  // Same person, two tabs: an older one still on Queue, a newer one on Generated.
  // The old "first active wins" dedup returned "Queue"; it should be "Generated".
  const state: Record<string, PresenceMeta[]> = {
    "dev@x.co": [
      meta({ email: "dev@x.co", page: "Queue", online_at: "2026-06-11T10:00:00.000Z" }),
      meta({ email: "dev@x.co", page: "Generated", online_at: "2026-06-11T10:05:00.000Z" }),
    ],
  };
  const [u] = collapsePresence(state, "dev@x.co");
  expect(u.page).toBe("Generated");
  expect(u.isSelf).toBe(true);
  expect(u.idle).toBe(false);
});

test("active if any tab active; idle only when all idle; page from most recent active tab", () => {
  const state: Record<string, PresenceMeta[]> = {
    "a@x.co": [
      meta({ email: "a@x.co", page: "Queue", idle: true, online_at: "2026-06-11T10:00:00.000Z" }),
      meta({ email: "a@x.co", page: "Directory", idle: false, online_at: "2026-06-11T10:01:00.000Z" }),
    ],
    "b@x.co": [
      meta({ email: "b@x.co", page: "Queue", idle: true, online_at: "2026-06-11T09:00:00.000Z" }),
    ],
  };
  const users = collapsePresence(state, "self@x.co");
  const a = users.find((u) => u.email === "a@x.co")!;
  const b = users.find((u) => u.email === "b@x.co")!;
  expect(a.idle).toBe(false);
  expect(a.page).toBe("Directory"); // most recent ACTIVE tab, not the idle Queue tab
  expect(b.idle).toBe(true);
  expect(b.page).toBe("Queue");
});

test("self sorts first, then active before idle", () => {
  const state: Record<string, PresenceMeta[]> = {
    "z@x.co": [meta({ email: "z@x.co", page: "Queue", online_at: "2026-06-11T10:00:00.000Z" })],
    "self@x.co": [meta({ email: "self@x.co", page: "Directory", online_at: "2026-06-11T10:00:00.000Z" })],
    "idle@x.co": [meta({ email: "idle@x.co", page: "Queue", idle: true, online_at: "2026-06-11T10:00:00.000Z" })],
  };
  const users = collapsePresence(state, "self@x.co");
  expect(users[0].email).toBe("self@x.co");
  expect(users[users.length - 1].email).toBe("idle@x.co");
});
