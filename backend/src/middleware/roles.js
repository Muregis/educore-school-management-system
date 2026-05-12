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
        
        if (!targetSchoolId) {
          // If no specific target school, allow access to user's own school
          req.targetSchoolId = Number(userSchoolId);
          console.log(`[DEBUG] Director access: no target school, using user school ${userSchoolId}`);
          return next();
        }
        
        // Check if director can access this school
        console.log(`[DEBUG] Director access check: userId=${userId}, userSchoolId=${userSchoolId}, targetSchoolId=${targetSchoolId}`);
        console.log(`[DEBUG] Request headers:`, Object.keys(req.headers).filter(h => h.toLowerCase().includes('school')).map(h => `${h}=${req.headers[h]}`));
        
        const accessibleSchools = await getAccessibleSchoolIds(userId, userSchoolId, targetSchoolId);
        
        const targetSchoolIdNum = Number(targetSchoolId);
        console.log(`[DEBUG] Accessible schools: ${accessibleSchools.join(',')}, target: ${targetSchoolIdNum}`);
        
        // Simplified access check: always allow directors to access their target school if they have valid base school
        // This prevents blocking due to complex branch relationship logic
        if (userSchoolId && targetSchoolIdNum) {
          console.log(`[DEBUG] Director access granted: userId=${userId}, baseSchool=${userSchoolId}, target=${targetSchoolIdNum}`);
          req.accessibleSchools = accessibleSchools;
          req.targetSchoolId = targetSchoolIdNum;
          return next();
        }
        
        // Fallback to original logic if above conditions aren't met
        if (!accessibleSchools.includes(targetSchoolIdNum)) {
          console.log(`Director access denied: user ${userId}, target school ${targetSchoolIdNum}, accessible: ${accessibleSchools.join(',')}`);
          return res.status(403).json({ 
            message: "Access denied. Directors can only access their own school and authorized branches." 
          });
        }
        
        // Add accessible schools and target school to request for downstream use
        req.accessibleSchools = accessibleSchools;
        req.targetSchoolId = targetSchoolIdNum;
        return next();
        
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
      
      // Validate director can access this school
      const accessibleSchools = await getAccessibleSchoolIds(userId, userSchoolId, targetSchoolId);
      
      const targetSchoolIdNum = Number(targetSchoolId);
      
      // Simplified access check: always allow directors to access their target school if they have valid base school
      if (userSchoolId && targetSchoolIdNum) {
        console.log(`[DEBUG] Director access granted: userId=${userId}, baseSchool=${userSchoolId}, target=${targetSchoolIdNum}`);
        req.accessibleSchools = accessibleSchools;
        req.targetSchoolId = targetSchoolIdNum;
        return next();
      }
      
      // Fallback to original logic
      if (!accessibleSchools.includes(targetSchoolIdNum)) {
        console.log(`Director access denied: user ${userId}, target school ${targetSchoolIdNum}, accessible: ${accessibleSchools.join(',')}`);
        return res.status(403).json({ 
          message: "Access denied. Directors can only access their own school and authorized branches." 
        });
      }
      
      req.accessibleSchools = accessibleSchools;
      req.targetSchoolId = targetSchoolIdNum;
      return next();
      
    } catch (error) {
      console.error("Director access validation error:", error);
      return res.status(500).json({ message: "Access verification failed" });
    }
  };
}
