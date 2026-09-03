const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const routes = require("./routes");

const apiRateLimiter = require("./shared/middlewares/apiRateLimit.middleware");
const notFoundMiddleware = require("./shared/middlewares/notFound.middleware");
const errorMiddleware = require("./shared/middlewares/error.middleware");

const allowedOrigins = [
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:3000",
  "https://localhost:3000",
  "https://127.0.0.1:3000"
];

const app = express();

app.use(helmet());



app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(apiRateLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

app.use("/api", routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
