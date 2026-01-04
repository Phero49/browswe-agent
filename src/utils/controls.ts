import {readFile } from "fs/promises";
import { APP_PATH, checkDebugPort } from "../md/cmd/commandList";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export async function getControlCss() {
      const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // now paths are stable no matter where bun is run from
  const file = join(__dirname, "../../assets/control.css");
  const css =   await readFile(file,{encoding:'utf-8'})
return css
}