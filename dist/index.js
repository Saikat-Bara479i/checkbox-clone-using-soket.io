import express from "express";
import axios from "axios";
import { Redis } from "ioredis";
import http from "http";
import { Server } from "socket.io";
const redis = new Redis({ host: "localhost", port: Number(6379) });
const app = express();
const httpServer = http.createServer(app);
const io = new Server({});
const TOTAL_CHECKBOXES = 1000;
const CHECKBOX_STATE_KEY = "checkbox_state";
async function getCheckboxState() {
    const storedState = await redis.hgetall(CHECKBOX_STATE_KEY);
    return Array.from({ length: TOTAL_CHECKBOXES }, (_, index) => {
        return storedState[index.toString()] === "true";
    });
}
io.attach(httpServer);
io.on("connection", async (socket) => {
    console.log(`a user connected ${socket.id}`);
    socket.emit("checkbox-state", await getCheckboxState());
    socket.on("checkbox-update", async (data) => {
        const { index, value } = data;
        if (!Number.isInteger(index) ||
            index < 0 ||
            index >= TOTAL_CHECKBOXES ||
            typeof value !== "boolean") {
            return;
        }
        await redis.hset(CHECKBOX_STATE_KEY, index.toString(), value.toString());
        io.emit("checkbox-update", { index, value });
    });
});
app.use(express.static("./public"));
app.use(async function (req, res, next) {
    const key = "rate_limit";
    const value = await redis.get(key);
    if (value === null) {
        redis.set(key, 0);
        redis.expire(key, 60);
    }
    if (value && Number(value) >= 10) {
        return res.status(429).json({ message: "Too many requests" });
    }
    redis.incr(key);
    next();
});
const PORT = 3000;
const cachestore = {
    name: "",
};
app.get("/", (req, res) => {
    return res.json({
        message: "Hello World ",
    });
});
app.get("/api", async (req, res) => {
    const cachedValue = await redis.get("name");
    if (cachedValue) {
        console.log("Cache hit");
        return res.json({
            data: cachedValue,
        });
    }
    const response = await axios.get("https://api.agify.io/?name=meelad");
    cachestore.name = response.data.name;
    await redis.set("name", response.data.name);
    console.log("Cache miss");
    return res.json({
        data: response.data.name,
    });
});
httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map