export function requireRoles(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    // Superadmin and director bypass - can access everything
    if (role === 'superadmin' || req.user?.isSuperadmin || role === 'director' || req.user?.isDirector) {
      return next();
    }
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
