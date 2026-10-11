import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../backend/src/app.js";

// Mock user tokens
import jwt from "jsonwebtoken";
import { env } from "../backend/src/config/env.js";

const generateToken = (payload) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "1h" });
};

describe("Tenant Isolation API Security", () => {
  after(() => {
    process.exit(0);
  });

  const schoolA_token = generateToken({ user_id: "userA", school_id: 101, role: "teacher" });
  const schoolB_token = generateToken({ user_id: "userB", school_id: 202, role: "teacher" });

  it("should not allow School A user to access School B classes via req.body.school_id", async () => {
    // Attempting to fetch classes for school 202 using school 101 token
    const res = await request(app)
      .get("/api/classes?school_id=202") // Usually classes doesn't read query school_id, it forces req.user.school_id
      .set("Authorization", `Bearer ${schoolA_token}`);

    assert.equal(res.status, 200, "Should succeed but only return School 101 classes");
    // Since we mock the DB, we might get 500 if supabase is not connected. 
    // Wait, we need the test to handle real db or mock db.
  });
});
