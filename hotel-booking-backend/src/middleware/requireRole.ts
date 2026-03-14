import { NextFunction, Request, Response } from "express";
import User from "../models/user";
import { AppRole } from "../lib/user-role";

const requireRole = (...allowedRoles: AppRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        return res.status(401).json({ message: "unauthorized" });
      }

      const user = await User.findById(req.userId).select("role");
      if (!user) {
        return res.status(401).json({ message: "unauthorized" });
      }

      const role = (user.role || "user") as AppRole;
      req.userRole = role;

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ message: "forbidden" });
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: "Role check failed" });
    }
  };
};

export default requireRole;
