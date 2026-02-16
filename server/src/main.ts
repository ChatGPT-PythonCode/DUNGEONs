import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import { createRouter } from "./routes/index.js";
import { registerSocket } from "./realtime/socket.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
registerSocket(io);

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(createRouter(io));

const port = Number(process.env.PORT ?? 4000);
server.listen(port, "0.0.0.0", () => {
  console.log(`server listening on ${port}`);
});
