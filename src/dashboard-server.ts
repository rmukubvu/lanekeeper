import http from "node:http";
import { loadConfig } from "./config.js";
import { handleDashboard } from "./dashboard.js";
import { EventStore } from "./store.js";

const config = loadConfig();
const store = new EventStore(config.dataDir);

http
  .createServer((req, res) => {
    if (handleDashboard(req, res, store)) return;
    res.writeHead(404).end();
  })
  .listen(config.dashboardPort, () => {
    console.log(
      `lanekeeper dashboard on http://localhost:${config.dashboardPort} (data: ${config.dataDir})`,
    );
  });
