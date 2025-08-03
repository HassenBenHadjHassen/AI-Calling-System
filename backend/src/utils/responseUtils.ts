import { Response } from "express";

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export class ResponseUtils {
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode: number = 200
  ): void {
    const response: ApiResponse<T> = {
      success: true,
      data,
      ...(message && { message }),
    };
    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    error: string,
    statusCode: number = 500
  ): void {
    const response: ApiResponse = {
      success: false,
      data: null,
      error,
    };
    res.status(statusCode).json(response);
  }

  static notFound(res: Response, message: string = "Resource not found"): void {
    this.error(res, message, 404);
  }

  static badRequest(res: Response, message: string = "Bad request"): void {
    this.error(res, message, 400);
  }

  static unauthorized(res: Response, message: string = "Unauthorized"): void {
    this.error(res, message, 401);
  }

  static forbidden(res: Response, message: string = "Forbidden"): void {
    this.error(res, message, 403);
  }

  static conflict(res: Response, message: string = "Conflict"): void {
    this.error(res, message, 409);
  }

  static unprocessableEntity(
    res: Response,
    message: string = "Unprocessable entity"
  ): void {
    this.error(res, message, 422);
  }
} 