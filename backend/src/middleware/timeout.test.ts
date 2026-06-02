import { Request, Response, NextFunction } from "express";
import { timeoutMiddleware } from "./timeout";

describe("timeoutMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let onMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();
    onMock = jest.fn();

    req = {
      method: "POST",
      path: "/api/test",
      headers: {},
    } as Partial<Request>;

    res = {
      status: statusMock,
      json: jsonMock,
      on: onMock,
      headersSent: false,
    } as Partial<Response>;

    next = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should call next immediately", () => {
    const middleware = timeoutMiddleware(30000);
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should return 503 when request exceeds timeout", () => {
    const middleware = timeoutMiddleware(1000);
    middleware(req as Request, res as Response, next);

    jest.advanceTimersByTime(1001);

    expect(statusMock).toHaveBeenCalledWith(503);
    expect(jsonMock).toHaveBeenCalledWith({
      error: "Service Unavailable",
      message: "Request exceeded the maximum allowed time of 10 seconds",
    });
  });

  it("should not timeout if response finishes in time", () => {
    const middleware = timeoutMiddleware(1000);
    middleware(req as Request, res as Response, next);

    const finishCallback = onMock.mock.calls.find(
      (call) => call[0] === "finish"
    )?.[1];
    finishCallback();

    jest.advanceTimersByTime(1001);

    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it("should not send response if headers already sent", () => {
    const middleware = timeoutMiddleware(1000);
    res.headersSent = true;
    middleware(req as Request, res as Response, next);

    jest.advanceTimersByTime(1001);

    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it("should clear timer on response close", () => {
    const middleware = timeoutMiddleware(1000);
    middleware(req as Request, res as Response, next);

    const closeCallback = onMock.mock.calls.find(
      (call) => call[0] === "close"
    )?.[1];
    closeCallback();

    jest.advanceTimersByTime(1001);

    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).not.toHaveBeenCalled();
  });

  it("should log timeout with request context", () => {
    const mockLogger = {
      warn: jest.fn(),
    };
    (req as any).logger = mockLogger;
    (req as any).requestId = "test-request-id";

    const middleware = timeoutMiddleware(15000);
    middleware(req as Request, res as Response, next);

    jest.advanceTimersByTime(15001);

    expect(mockLogger.warn).toHaveBeenCalledWith("Request timed out", expect.objectContaining({
      requestId: "test-request-id",
      method: "POST",
      path: "/api/test",
      timeoutMs: 15000,
    }));
    const logDetails = mockLogger.warn.mock.calls[0][1];
    expect(logDetails).toHaveProperty("elapsedTime");
    expect(typeof logDetails.elapsedTime).toBe("string");
    expect(logDetails.elapsedTime).toMatch(/\d+ms/);
  });

  it("should skip timeout for WebSocket upgrade requests", () => {
    req.headers = { upgrade: "websocket" };
    const middleware = timeoutMiddleware(1000);
    middleware(req as Request, res as Response, next);

    jest.advanceTimersByTime(1001);

    expect(statusMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
