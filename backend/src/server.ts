import "dotenv/config";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 6333);
const app = createApp();

app.listen(port, () => {
  console.log(`ShipShape backend listening on http://localhost:${port}`);
});
