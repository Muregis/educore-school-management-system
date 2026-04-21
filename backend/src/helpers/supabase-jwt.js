import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Generate Supabase-compatible JWT with custom school_id claim
 * This token can be used with Supabase client for RLS policies
 */
export function generateSupabaseJWT(user) {
  // OLD:
  // const { userId, schoolId, role, name } = user;
  const { user_id, school_id, role, name, parent_school_id, is_branch, accessible_school_ids } = user;
  
  // OLD:
  // console.log("🔐 Generating Supabase JWT for schoolId:", schoolId);
  console.log("🔐 Generating Supabase JWT for school_id:", school_id);
  
  // Supabase JWT structure
  const payload = {
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 days
    // OLD:
    // sub: userId.toString(), // Must be string
    sub: user_id.toString(), // Must be string
    email: user.email || null,
    role: "authenticated",
    app_metadata: {
      provider: "custom",
      role: role
    },
    user_metadata: {
      name: name,
      // OLD:
    // school_id: schoolId // Custom claim for RLS
    school_id: school_id, // Custom claim for RLS
    // NEW: Branch support
    parent_school_id: parent_school_id || null,
    is_branch: is_branch || false,
    accessible_school_ids: accessible_school_ids || null
    },
    // Custom claim at root level for easier access in RLS
    // OLD:
    // school_id: schoolId
    school_id: school_id,
    // NEW: Branch claims at root level
    parent_school_id: parent_school_id || null,
    is_branch: is_branch || false,
    accessible_school_ids: accessible_school_ids || null
  };

  if (!env.supabaseJwtSecret) {
    console.error("❌ SUPABASE_JWT_SECRET not configured");
    throw new Error("SUPABASE_JWT_SECRET not configured");
  }

  console.log("✅ Supabase JWT Secret found, signing token...");
  const token = jwt.sign(payload, env.supabaseJwtSecret, { algorithm: 'HS256' });
  console.log("✅ Supabase JWT generated successfully");
  
  return token;
}

/**
 * Verify Supabase JWT (useful for debugging)
 */
export function verifySupabaseJWT(token) {
  if (!env.supabaseJwtSecret) {
    throw new Error("SUPABASE_JWT_SECRET not configured");
  }
  
  return jwt.verify(token, env.supabaseJwtSecret);
}
