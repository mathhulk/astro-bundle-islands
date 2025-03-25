import path from "path";
import fs from "fs";
import crypto from "crypto";
import { AstroIntegrationLogger } from "astro";

/**
 * Convert an export statement to a return statement
 */
const convertExportToReturn = (js: string) => {
  const regex = /export\s*{\s*([^}]+)\s*}/;

  const match = js.match(regex);

  if (match) {
    const exports = match[1].split(",").map((item) => item.trim());

    const returnMap: Record<string, string> = {};

    exports.forEach((expression) => {
      const [local, alias] = expression
        .split(" as ")
        .map((part) => part.trim());

      returnMap[alias || local] = local;
    });

    return js.replace(
      regex,
      `return ${JSON.stringify(returnMap).replaceAll('"', "")}`
    );
  }

  return js;
};

/**
 * Convert an import statement to a mock import statement
 */
const convertImportToMockImport = (
  dir: URL,
  logger: AstroIntegrationLogger,
  dependencies: [string, string][],
  js: string
) => {
  const regex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(js)) !== null) {
    const name = path.basename(match[2]);

    processReference(dir, logger, dependencies, name);

    const imports = match[1].split(",").map((item) => item.trim());

    const importMap: Record<string, string> = {};

    imports.forEach((expression) => {
      const [local, alias] = expression
        .split(" as ")
        .map((part) => part.trim());

      importMap[local || alias] = alias || local;
    });

    js = js.replace(
      match[0],
      `const ${JSON.stringify(importMap).replaceAll(
        '"',
        ""
      )} = __import("${name}")`
    );
  }

  return js;
};

/**
 * Process a JavaScript file
 */
const processReference = (
  dir: URL,
  logger: AstroIntegrationLogger,
  dependencies: [string, string][],
  filePath: string
) => {
  const name = path.basename(filePath);

  const existingDependency = dependencies.find(
    ([existingName]) => existingName === name
  );

  // Skip dependencies that have already been processed
  if (existingDependency) return;

  const fullPath = path.resolve(dir.pathname, "_astro", name);

  let js = fs.readFileSync(fullPath, "utf-8");

  js = convertImportToMockImport(dir, logger, dependencies, js);
  js = convertExportToReturn(js);

  dependencies.push([name, js]);
};

/**
 * Process an HTML file to bundle JavaScript dependencies
 */
const processAsset = (
  dir: URL,
  logger: AstroIntegrationLogger,
  modules: string[],
  name: string,
  asset: URL[]
) => {
  const pathname = asset[0].pathname;

  // Skip assets that are not HTML files
  if (!pathname.endsWith(".html")) {
    logger.warn(`Skipping asset (not HTML): ${name}`);

    return;
  }

  let html = fs.readFileSync(pathname, "utf-8");

  // Find any module references
  const expression = /"([^"]*?\.js)"/g;

  const references: string[] = [];

  let match: RegExpExecArray | null;

  while ((match = expression.exec(html)) !== null) {
    if (match[1]) {
      references.push(match[1]);
    }
  }

  // Skip assets with no module references
  if (references.length === 0) {
    logger.debug(`Skipping asset (no islands found): ${name}`);

    return;
  }

  // Manually bundle dependencies
  const dependencies: [string, string][] = [];

  for (const reference of references) {
    processReference(dir, logger, dependencies, reference);
  }

  modules.push(...dependencies.map(([name]) => name));

  // Generate a variable for each dependency
  let bundle = "";

  for (const index in dependencies) {
    const [name, js] = dependencies[index];

    bundle += `// ${name}\nconst __import${index} = (() => {${js}})();\n\n`;
  }

  // Generate a map of all dependencies
  bundle +=
    "const __imports = {" +
    dependencies
      .map(([name], index) => {
        return `"${name}": __import${index}`;
      })
      .join(",") +
    "};\n";

  // Generate a function to import a dependency
  bundle += "const __import = (name) => __imports[name];\n\n";

  // Replace all mock imports with variable references in the bundle
  for (const index in dependencies) {
    const [name] = dependencies[index];

    bundle = bundle.replaceAll(`__import("${name}")`, `__import${index}`);
  }

  // Write the bundle to a file
  const id = crypto.randomUUID();

  const script = `${id}.js`;
  fs.writeFileSync(path.resolve(dir.pathname, "_astro", script), bundle);

  const scriptPath = references[0].replaceAll(
    /((?:\.*?\/)+).*/g,
    `$1_astro/${script}`
  );

  // Replace all imports
  html = html
    .replaceAll("import(", "__import(")
    .replaceAll(/(?:\.*?\/)+_astro\/(.+?\.js)/g, "$1")
    .replace("<script>", `<script src="${scriptPath}"></script><script>`);

  fs.writeFileSync(pathname, html);

  logger.info(`Bundled islands: ${name} (${script})`);

  return html;
};

const bundleIslands = async (
  assets: Map<string, URL[]>,
  dir: URL,
  logger: AstroIntegrationLogger
) => {
  // Process assets and replace island JavaScript modules with bundles
  const modules: string[] = [];

  for (const [name, asset] of assets.entries()) {
    processAsset(dir, logger, modules, name, asset);
  }

  if (modules.length === 0) {
    logger.info("No islands found");

    return;
  }

  // Remove island JavaScript modules
  const _astro = path.resolve(dir.pathname, "_astro");

  for (const module of modules) {
    const modulePath = path.resolve(_astro, module);

    if (!fs.existsSync(modulePath)) return;

    fs.unlinkSync(modulePath);
  }
};

export default bundleIslands;
