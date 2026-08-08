import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export async function registerTools(server: McpServer) {
  // Get current file directory path
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Read all files in the tools directory
  const files = fs.readdirSync(__dirname);

  // Filter .ts or .js files, excluding index and register files
  const toolFiles = files.filter(
    (file) =>
      (file.endsWith(".ts") || file.endsWith(".js")) &&
      file !== "index.ts" &&
      file !== "index.js" &&
      file !== "register.ts" &&
      file !== "register.js" &&
      !file.endsWith(".test.ts") &&
      !file.endsWith(".test.js") &&
      !file.startsWith("_")
  ).sort();

  // Dynamically import and register each tool
  for (const file of toolFiles) {
    try {
      // Build import path
      const importPath = `./${file.replace(/\.(ts|js)$/, ".js")}`;

      // Dynamically import module
      const module = await import(importPath);

      // Find and execute registration function
      const registerFunctionName = Object.keys(module).find(
        (key) => key.startsWith("register") && typeof module[key] === "function"
      );

      if (registerFunctionName) {
        module[registerFunctionName](server);
        console.error(`[MCP] Registered tool: ${file}`);
      } else {
        console.error(`[MCP] Warning: No registration function found in file ${file}`);
      }
    } catch (error) {
      console.error(`Error registering tool ${file}:`, error);
    }
  }
}
