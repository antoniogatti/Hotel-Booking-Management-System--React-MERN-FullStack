type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : "Unknown error",
  };
};

const writeLog = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logInfo = (message: string, context?: LogContext) => {
  writeLog("info", message, context);
};

export const logWarn = (message: string, context?: LogContext) => {
  writeLog("warn", message, context);
};

export const logError = (message: string, error?: unknown, context?: LogContext) => {
  writeLog("error", message, {
    ...(context || {}),
    ...(error !== undefined ? { error: serializeError(error) } : {}),
  });
};