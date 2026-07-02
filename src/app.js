const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
// const userRoutes = require("./modules/user/user.routes");
const notFoundMiddleware = require("./middlewares/notFound.middleware");
const errorMiddleware = require("./middlewares/error.middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
  });
});

// app.use("/api/users", userRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;