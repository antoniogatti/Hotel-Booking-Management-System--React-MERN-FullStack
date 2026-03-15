import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

const port = process.env.PORT || 5000;
const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || `http://localhost:${port}`;

const servers = [{ url: backendUrl, description: "API Server" }];
if (process.env.BACKEND_URL) {
  servers.push({
    url: `http://localhost:${port}`,
    description: "Local development",
  });
}

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Palazzo Pinto B&B API",
      version: "1.0.0",
      description: "A comprehensive API for Palazzo Pinto B&B operations",
      contact: {
        name: "API Support",
        email: "support@mernholidays.com",
      },
    },
    servers,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "jwt",
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
  },
  // Support both .ts (dev) and .js (production build) - path relative to this file
  apis: [
    path.join(__dirname, "routes", "*.ts"),
    path.join(__dirname, "routes", "*.js"),
  ],
};

export const specs = swaggerJsdoc(options);
