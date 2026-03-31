export function requireRoles(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    // Superadmin bypass - can access everything
    if (role === 'superadmin' || req.user?.isSuperadmin) {
      return next();
    }
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    return next();
  };
}
