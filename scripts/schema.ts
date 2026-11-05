// Writes fleet.schema.json from the Zod config schema, for editor autocomplete
// and validation in fleet.config.json. Run with: bun run schema
import { fleetConfigSchema } from "../src/validators/config";

import { z } from "zod";

const schema = z.toJSONSchema(fleetConfigSchema, { io: "input" });
await Bun.write("fleet.schema.json", JSON.stringify(schema, null, 4) + "\n");
console.log("wrote fleet.schema.json");
