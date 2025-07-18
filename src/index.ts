import { app } from "./routes";
import { Browser } from "./browser";

const handler = {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;

export { Browser };
export default handler;