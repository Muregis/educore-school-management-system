import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
// OLD: import { agentLog } from "../utils/agentDebugLog.js";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    // #region agent log
    // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'analysis-pre',hypothesisId:'H1',location:'backend/src/middleware/auth.js:11',message:'authRequired missing token',data:{hasAuthHeader:Boolean(header),path:req.path,method:req.method},timestamp:Date.now()})}).catch(()=>{});
    // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H1",location:"backend/src/middleware/auth.js:11",message:"authRequired missing token",data:{hasAuthHeader:Boolean(header),path:req.path,method:req.method},timestamp:Date.now()});
    // #endregion
    return res.status(401).json({ message: "Missing auth token" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = payload;
    // #region agent log
    // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'analysis-pre',hypothesisId:'H1',location:'backend/src/middleware/auth.js:20',message:'authRequired verified jwt',data:{path:req.path,method:req.method,payloadKeys:Object.keys(payload||{}),school_id:payload?.school_id,schoolId:payload?.schoolId,user_id:payload?.user_id,userId:payload?.userId},timestamp:Date.now()})}).catch(()=>{});
    // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H1",location:"backend/src/middleware/auth.js:20",message:"authRequired verified jwt",data:{path:req.path,method:req.method,payloadKeys:Object.keys(payload||{}),school_id:payload?.school_id,schoolId:payload?.schoolId,user_id:payload?.user_id,userId:payload?.userId},timestamp:Date.now()});
    // #endregion
    // Ensure backward compatibility during transition
    if (payload.school_id) {
      req.user.schoolId = payload.school_id;
    }
    if (payload.user_id) {
      req.user.userId = payload.user_id;
    }
    return next();
  } catch {
    // #region agent log
    // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'analysis-pre',hypothesisId:'H2',location:'backend/src/middleware/auth.js:37',message:'authRequired jwt verify failed',data:{path:req.path,method:req.method},timestamp:Date.now()})}).catch(()=>{});
    // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H1",location:"backend/src/middleware/auth.js:37",message:"authRequired jwt verify failed",data:{path:req.path,method:req.method},timestamp:Date.now()});
    // #endregion
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
