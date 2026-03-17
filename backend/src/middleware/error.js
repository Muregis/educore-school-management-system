// OLD: import { agentLog } from "../utils/agentDebugLog.js";

export function errorHandler(err, req, res, next) {
  console.error(err);
  // #region agent log
  // OLD: fetch('http://127.0.0.1:7316/ingest/69a2e703-a35d-4b5d-8b01-2ade717190dd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdda91'},body:JSON.stringify({sessionId:'cdda91',runId:'pre-fix',hypothesisId:'H5',location:'backend/src/middleware/error.js:6',message:'errorHandler caught error',data:{path:req?.path,method:req?.method,message:err?.message,name:err?.name,code:err?.code,stackTop:String(err?.stack||'').split('\n').slice(0,5).join('\n'),school_id:req?.user?.school_id,schoolId:req?.user?.schoolId,reqSchoolId:req?.schoolId},timestamp:Date.now()})}).catch(()=>{});
  // OLD: agentLog({sessionId:"cdda91",runId:"pre-fix",hypothesisId:"H5",location:"backend/src/middleware/error.js:6",message:"errorHandler caught error",data:{path:req?.path,method:req?.method,message:err?.message,name:err?.name,code:err?.code,stackTop:String(err?.stack||'').split('\n').slice(0,5).join('\n'),school_id:req?.user?.school_id,schoolId:req?.user?.schoolId,reqSchoolId:req?.schoolId},timestamp:Date.now()});
  // OLD: agentLog({sessionId:"cdda91",runId:"repro",hypothesisId:"H5",location:"backend/src/middleware/error.js:6",message:"errorHandler caught error",data:{path:req?.path,method:req?.method,message:err?.message,name:err?.name,code:err?.code,stackTop:String(err?.stack||'').split('\n').slice(0,8).join('\n'),school_id:req?.user?.school_id,schoolId:req?.user?.schoolId,reqSchoolId:req?.schoolId},timestamp:Date.now()});
  // #endregion

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  return res.status(status).json({
    message: err.message || "Internal server error"
  });
}
