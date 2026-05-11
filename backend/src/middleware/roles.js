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
        const targetSchoolId = req.headers['x-school-id'] || 
                            req.headers['x-effective-school-id'] || 
                            req.params.schoolId || 
                            req.query.schoolId || 
                            req.body.schoolId || 
                            userSchoolId;
        
        if (!targetSchoolId) {
          return res.status(403).json({ message: "Director must specify school context" });
        }
        
        // Check if director can access this school
        const accessibleSchools = await getAccessibleSchoolIds(userId, userSchoolId);
        
        if (!accessibleSchools.includes(Number(targetSchoolId))) {
          return res.status(403).json({ 
            message: "Access denied. Directors can only access their own school and authorized branches." 
          });
        }
        
        // Add accessible schools to request for downstream use
        req.accessibleSchools = accessibleSchools;
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
      const targetSchoolId = req.headers['x-school-id'] || 
                          req.headers['x-effective-school-id'] || 
                          req.params.schoolId || 
                          req.query.schoolId || 
                          req.body.schoolId || 
                          userSchoolId;
      
      if (!targetSchoolId) {
        return res.status(403).json({ message: "Director must specify school context" });
      }
      
      // Validate director can access this school
      const accessibleSchools = await getAccessibleSchoolIds(userId, userSchoolId);
      
      if (!accessibleSchools.includes(Number(targetSchoolId))) {
        return res.status(403).json({ 
          message: "Access denied. Directors can only access their own school and authorized branches." 
        });
      }
      
      req.accessibleSchools = accessibleSchools;
      return next();
      
    } catch (error) {
      console.error("Director access validation error:", error);
      return res.status(500).json({ message: "Access verification failed" });
    }
  };
}
