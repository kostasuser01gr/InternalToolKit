/**
 * client-boundary-audit.ts
 * Scans components for interactive hooks/handlers and warns if "use client" is missing.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const COMPONENT_DIRS = ["apps/web/components", "apps/web/app"];
const INTERACTIVE_MARKERS = ["onClick", "onSubmit", "useState", "useEffect", "useContext", "useReducer", "useCallback", "useMemo"];

function scanDir(dir: string) {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) return;

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(entryPath);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const content = fs.readFileSync(path.join(process.cwd(), entryPath), "utf-8");
      const hasUseClient = content.includes('"use client"') || content.includes("'use client'");
      
      const foundMarkers = INTERACTIVE_MARKERS.filter(m => content.includes(m));
      
      if (foundMarkers.length > 0 && !hasUseClient) {
        // Exclude some false positives (e.g. types or server actions that just happen to have these strings)
        if (content.includes("export async function") && !content.includes("return <")) {
           // likely a server action file, skip
           continue;
        }
        
        console.warn(`⚠️  POTENTIAL MISSING "use client": ${entryPath}`);
        console.warn(`   Found markers: ${foundMarkers.join(", ")}`);
      }
    }
  }
}

console.log("--- Starting Client Boundary Audit ---");
COMPONENT_DIRS.forEach(scanDir);
console.log("--- Audit Complete ---");
