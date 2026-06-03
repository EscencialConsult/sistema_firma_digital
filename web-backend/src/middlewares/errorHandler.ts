import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    const flattened = error.flatten();
    const messages = Object.entries(flattened.fieldErrors)
      .map(([field, errors]) => `${field}: ${errors?.join(", ")}`)
      .concat(flattened.formErrors);
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: messages.length ? messages.join("; ") : "Datos invalidos.",
      details: flattened
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message
    });
  }

  console.error(error);
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "Ocurrio un error inesperado."
  });
};

