import type { RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Ruta no encontrada: ${req.method} ${req.path}`
  });
};

