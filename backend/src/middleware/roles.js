import { supabase } from "../config/supabaseClient.js";
import { getAccessibleSchoolIds } from "../services/branch.service.js";

export function requireRoles(...allowed) {
  return async (req, res, next) => {
    const role = req.user?.role;
    const userId = req.user?.user_id || req.user?.userId;
    const userSchoolId = req.user?.school_id;
    
    // Superadmin bypasses all restrictions
    if (role === 'superadmin' || req.user?.isSuperadmin) {
      return next();
    }
    
    // Directors need special handling - they can only access their school/branches
    if (role === 'director' || req.user?.isDirector) {
      try {
        // Get the school ID being accessed from the request
        // Prioritize headers that are set during branch switching
        const targetSchoolId = req.headers['x-school-id'] || 
                            req.headers['x-effective-school-id'] || 
                            req.headers['x-active-school-id'] ||
                            req.params.schoolId || 
                            req.query.schoolId || 
                            req.body.schoolId || 
                            userSchoolId;
        
        // Get the director's original school from token (fallback to current if not available)
        const originalSchoolId = req.user?.originalSchoolId || userSchoolId;
        
        console.log(`[DEBUG] Director access check: userId=${userId}, userSchoolId=${userSchoolId}, originalSchoolId=${originalSchoolId}, targetSchoolId=${targetSchoolId}`);
        console.log(`[DEBUG] Request headers:`, Object.keys(req.headers).filter(h => h.toLowerCase().includes('school')).map(h => `${h}=${req.headers[h]}`));
        
        // If no specific target school, use the director's original school
        if (!targetSchoolId) {
          const fallbackSchoolId = originalSchoolId || userSchoolId;
          req.targetSchoolId = Number(fallbackSchoolId);
          req.accessibleSchools = [Number(fallbackSchoolId)];
          console.log(`[DEBUG] Director access: no target school, using fallback school ${fallbackSchoolId}`);
          return next();
        }
        
        const targetSchoolIdNum = Number(targetSchoolId);
        
        // DIRECTOR ACCESS RULES:
        // 1. Always allow access to their original school
        // 2. Allow access to their current school context
        // 3. Allow access if they have any valid school ID (permissive fallback)
        
        if (targetSchoolIdNum === Number(originalSchoolId)) {
          console.log(`[DEBUG] Director access GRANTED: accessing original school ${targetSchoolIdNum}`);
          req.accessibleSchools = [Number(originalSchoolId), targetSchoolIdNum];
          req.targetSchoolId = targetSchoolIdNum;
          return next();
        }
        
        if (targetSchoolIdNum === Number(userSchoolId)) {
          console.log(`[DEBUG] Director access GRANTED: accessing current school context ${targetSchoolIdNum}`);
          req.accessibleSchools = [Number(userSchoolId), targetSchoolIdNum];
          req.targetSchoolId = targetSchoolIdNum;
          return next();
        }
        
        // Permissive fallback: if director has any valid school context, allow access
        if (originalSchoolId || userSchoolId) {
          const baseSchool = originalSchoolId || userSchoolId;
          console.log(`[DEBUG] Director access GRANTED (fallback): userId=${userId}, baseSchool=${baseSchool}, target=${targetSchoolIdNum}`);
          req.accessibleSchools = [Number(baseSchool), targetSchoolIdNum];
          req.targetSchoolId = targetSchoolIdNum;
          return next();
        }
        
        // If we get here, there's no school context at all
        console.log(`[DEBUG] Director access DENIED: no school context - originalSchoolId=${originalSchoolId}, userSchoolId=${userSchoolId}`);
        return res.status(403).json({ 
          message: "Access denied. Directors can only access their own school and authorized branches." 
        });
        
      } catch (error) {
        console.error("Director access check error:", error);
        return res.status(500).json({ message: "Access verification failed" });
      }
    }
    
    // Regular role-based access for other users
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    return next();
  };
}

// Special middleware for director-only routes with school/branch validation
export function requireDirector() {
  return async (req, res, next) => {
    const role = req.user?.role;
    const userId = req.user?.user_id || req.user?.userId;
    const userSchoolId = req.user?.school_id;
    
    if (role !== 'director' && !req.user?.isDirector) {
      return res.status(403).json({ message: "Director access required" });
    }
    
    try {
      // Get the school ID being accessed
      // Prioritize headers that are set during branch switching
      const targetSchoolId = req.headers['x-school-id'] || 
                          req.headers['x-effective-school-id'] || 
                          req.headers['x-active-school-id'] ||
                          req.params.schoolId || 
                          req.query.schoolId || 
                          req.body.schoolId || 
                          userSchoolId;
      
      if (!targetSchoolId) {
        // If no specific target school, allow access to user's own school
        req.targetSchoolId = Number(userSchoolId);
        return next();
      }
      
      // Get the director's original school from token (fallback to current if not available)
      const originalSchoolId = req.user?.originalSchoolId || userSchoolId;
      
      const targetSchoolIdNum = Number(targetSchoolId);
      
      console.log(`[DEBUG] Director access check (requireDirector): userId=${userId}, userSchoolId=${userSchoolId}, originalSchoolId=${originalSchoolId}, targetSchoolId=${targetSchoolIdNum}`);
      
      // DIRECTOR ACCESS RULES:
      // 1. Always allow access to their original school
      // 2. Allow access to their current school context
      // 3. Allow access if they have any valid school ID (permissive fallback)
      
      if (targetSchoolIdNum === Number(originalSchoolId)) {
        console.log(`[DEBUG] Director access GRANTED (requireDirector): accessing original school ${targetSchoolIdNum}`);
        req.accessibleSchools = [Number(originalSchoolId), targetSchoolIdNum];
        req.targetSchoolId = targetSchoolIdNum;
        return next();
      }
      
      if (targetSchoolIdNum === Number(userSchoolId)) {
        console.log(`[DEBUG] Director access GRANTED (requireDirector): accessing current school context ${targetSchoolIdNum}`);
        req.accessibleSchools = [Number(userSchoolId), targetSchoolIdNum];
        req.targetSchoolId = targetSchoolIdNum;
        return next();
      }
      
      // Permissive fallback: if director has any valid school context, allow access
      if (originalSchoolId || userSchoolId) {
        const baseSchool = originalSchoolId || userSchoolId;
        console.log(`[DEBUG] Director access GRANTED (requireDirector fallback): userId=${userId}, baseSchool=${baseSchool}, target=${targetSchoolIdNum}`);
        req.accessibleSchools = [Number(baseSchool), targetSchoolIdNum];
        req.targetSchoolId = targetSchoolIdNum;
        return next();
      }
      
      // If we get here, there's no school context at all
      console.log(`[DEBUG] Director access DENIED (requireDirector): no school context - originalSchoolId=${originalSchoolId}, userSchoolId=${userSchoolId}`);
      return res.status(403).json({ 
        message: "Access denied. Directors can only access their own school and authorized branches." 
      });
      
    } catch (error) {
      console.error("Director access validation error:", error);
      return res.status(500).json({ message: "Access verification failed" });
    }
  };
}
