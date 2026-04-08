import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import userRoutes from "./routes/users";
import authRoutes from "./routes/auth";
import cookieParser from "cookie-parser";
import path from "path";
import myHotelRoutes from "./routes/my-hotels";
import hotelRoutes from "./routes/hotels";
import bookingRoutes from "./routes/my-bookings";
import bookingsManagementRoutes from "./routes/bookings";
import healthRoutes from "./routes/health";
import businessInsightsRoutes from "./routes/business-insights";
import contactRoutes from "./routes/contact";
import bookingComSyncRoutes from "./routes/booking-com-sync";
import swaggerUi from "swagger-ui-express";
import { specs } from "./swagger";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { startBookingComSyncScheduler } from "./lib/booking-com-ical";
import { logError, logInfo, logWarn } from "./lib/logger";

const isProduction = process.env.NODE_ENV === "production";
const useInMemoryMongo =
  !isProduction && process.env.USE_IN_MEMORY_MONGO === "true";
const normalizeOrigin = (origin: string) => origin.replace(/\/$/, "");
const normalizeForwardedProto = (protoHeader?: string | string[]) => {
  const value = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return value?.split(",")[0]?.trim().toLowerCase();
};
const isSecureRequest = (req: Request) =>
  req.secure || normalizeForwardedProto(req.headers["x-forwarded-proto"]) === "https";
const normalizeRateLimitIp = (ip?: string) => {
  if (!ip) {
    return "127.0.0.1";
  }

  return /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)
    ? ip.replace(/:\d+$/, "")
    : ip;
};
let mongoMemoryServer: MongoMemoryServer | null = null;

// Environment Variables Validation
const requiredEnvVars = [
  ...(useInMemoryMongo ? [] : ["MONGODB_CONNECTION_STRING"]),
  "JWT_SECRET_KEY",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logError("Missing required environment variables", undefined, {
    variables: missingEnvVars,
  });
  process.exit(1);
}

logInfo("Environment configuration validated", {
  environment: process.env.NODE_ENV || "development",
  frontendUrl: process.env.FRONTEND_URL || "not-set",
  backendUrl: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`,
  useInMemoryMongo,
});

// MongoDB Connection with Error Handling
const connectDB = async () => {
  try {
    const mongoUri = useInMemoryMongo
      ? await (async () => {
          const { MongoMemoryServer } = await import("mongodb-memory-server");
          mongoMemoryServer = await MongoMemoryServer.create({
            instance: { dbName: "hotel-booking-dev" },
          });
          const uri = mongoMemoryServer.getUri();
          logWarn("Using in-memory MongoDB for development", {
            dbName: "hotel-booking-dev",
          });
          return uri;
        })()
      : (process.env.MONGODB_CONNECTION_STRING as string);

    logInfo("Attempting MongoDB connection", {
      mode: useInMemoryMongo ? "in-memory" : "configured",
    });
    await mongoose.connect(mongoUri);
    logInfo("MongoDB connected successfully", {
      database: mongoose.connection.db.databaseName,
    });
    startBookingComSyncScheduler();
  } catch (error) {
    logError("MongoDB connection failed", error);
    process.exit(1);
  }
};

// Handle MongoDB connection events
mongoose.connection.on("disconnected", () => {
  logWarn("MongoDB disconnected. Driver will attempt to reconnect.");
});

mongoose.connection.on("error", (error) => {
  logError("MongoDB connection emitted an error", error);
});

mongoose.connection.on("reconnected", () => {
  logInfo("MongoDB reconnected successfully");
});

connectDB();

const app = express();

// Security middleware
app.use(
  helmet({
    hsts: isProduction
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false,
  })
);

// Trust proxy for production (fixes rate limiting issues)
app.set("trust proxy", 1);

if (isProduction) {
  app.use((req, res, next) => {
    if (isSecureRequest(req)) {
      return next();
    }

    const host = req.headers.host;

    if (!host) {
      return next();
    }

    const redirectUrl = `https://${host}${req.originalUrl}`;
    return res.redirect(308, redirectUrl);
  });
}

// Rate limiting for API endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for general requests
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(normalizeRateLimitIp(req.ip)),
});

app.use("/api/", generalLimiter);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(
  morgan((tokens, req, res) => {
    const status = Number(tokens.status(req, res) || 0);
    const responseTime = Number(tokens["response-time"](req, res) || 0);
    const contentLength = Number(tokens.res(req, res, "content-length") || 0) || undefined;

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      message: "http_request",
      context: {
        method: req.method,
        path: req.path,
        status,
        durationMs: responseTime,
        contentLength,
        ip: tokens["remote-addr"](req, res) || undefined,
        userAgent: tokens["user-agent"](req, res) || undefined,
      },
    });
  })
);

const configuredOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const defaultOrigins = isProduction
  ? []
  : [
  "http://localhost:5174",
  "http://localhost:5173",
  "http://localhost:5175",
  "http://localhost:5176",
];

const allowedOrigins = new Set(
  [...configuredOrigins, ...defaultOrigins]
    .filter((origin): origin is string => Boolean(origin))
    .map(normalizeOrigin)
);

const corsOriginHandler: cors.CorsOptions["origin"] = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.has(normalizeOrigin(origin))) {
    return callback(null, true);
  }

  if (!isProduction) {
    logWarn("CORS blocked origin", { origin });
  }

  return callback(new Error("Not allowed by CORS"));
};

if (isProduction && allowedOrigins.size === 0) {
  logWarn("No production CORS origins configured", {
    expectedSettings: ["FRONTEND_URL", "FRONTEND_URLS"],
  });
}

app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    optionsSuccessStatus: 204,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
    ],
  })
);
// Explicit preflight handler for all routes
app.options(
  "*",
  cors({
    origin: corsOriginHandler,
    credentials: true,
    optionsSuccessStatus: 204,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
    ],
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  // Ensure Vary header for CORS
  res.header("Vary", "Origin");
  next();
});

app.get("/", (req: Request, res: Response) => {
  res.send("<h1>Palazzo Pinto B&B Backend API is running 🚀</h1>");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/my-hotels", myHotelRoutes);
app.use("/api/rooms", hotelRoutes);
app.use("/api/my-bookings", bookingRoutes);
app.use("/api/bookings", bookingsManagementRoutes);
app.use("/api/integrations/booking-com", bookingComSyncRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/business-insights", businessInsightsRoutes);
app.use("/api/contact", contactRoutes);

// Swagger API Documentation
const swaggerEnabled = !isProduction || process.env.ENABLE_SWAGGER === "true";

if (swaggerEnabled) {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Palazzo Pinto B&B API Documentation",
    })
  );
}

// Dynamic Port Configuration (for Coolify/VPS and local development)
const PORT = process.env.PORT || 5000;

const backendBaseUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || `http://localhost:${PORT}`;

const server = app.listen(PORT, () => {
  logInfo("Backend server started", {
    port: Number(PORT),
    localUrl: `http://localhost:${PORT}`,
    publicUrl: backendBaseUrl,
    apiDocsUrl: swaggerEnabled ? `${backendBaseUrl}/api-docs` : undefined,
    healthUrl: `${backendBaseUrl}/api/health`,
  });
});

// Graceful Shutdown Handler
const gracefulShutdown = (signal: string) => {
  logWarn("Shutdown signal received", { signal });

  server.close(async () => {
    logInfo("HTTP server closed");

    try {
      await mongoose.connection.close();
      if (mongoMemoryServer) {
        await mongoMemoryServer.stop();
        mongoMemoryServer = null;
        logInfo("In-memory MongoDB stopped");
      }
      logInfo("MongoDB connection closed");
      logInfo("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logError("Error during graceful shutdown", error, { signal });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logError("Forced shutdown after timeout", undefined, { signal, timeoutMs: 30000 });
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logError("Uncaught exception", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logError("Unhandled promise rejection", reason, {
    promise: String(promise),
  });
  gracefulShutdown("UNHANDLED_REJECTION");
});
