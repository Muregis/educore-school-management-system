import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../backend/src/app.js";

describe("Health Check API", () => {
  after(() => {
    process.exit(0);
  });

  it("should return 200 OK", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });
});
