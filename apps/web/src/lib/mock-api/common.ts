export const delay = (ms = 300 + Math.random() * 300) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
