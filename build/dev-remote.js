#!/usr/bin/env node

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const BUILD_MODULE_PATH = path.join(__dirname, "build.js");
const IMAGE_ASSET_DIR = path.join(ROOT, "assets", "img");
const IMAGE_OPTIMIZER_PATH = path.join(__dirname, "optimize-images.py");
const WATCH_TARGETS = [path.join(ROOT, "content.json"), path.join(ROOT, "templates"), path.join(ROOT, "assets"), path.join(ROOT, "build")];
const DEFAULT_PORT = 4173;
const REBUILD_DEBOUNCE_MS = 250;
const IMAGE_OPTIMIZE_DEBOUNCE_MS = 800;
const GENERATED_IMAGE_EVENT_TTL_MS = 5000;
const MIN_REBUILD_INTERVAL_MS = 500;
const OPTIMIZABLE_IMAGE_SUFFIXES = new Set([".png"]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parsePort(value) {
  if (value == null || String(value).trim() === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`PORT must be an integer between 1 and 65535. Received: ${value}`);
  }

  return port;
}

function getPublicHost() {
  const host = String(process.env.PUBLIC_HOST || "").trim();
  if (!host) {
    fail("PUBLIC_HOST is required. Example: PUBLIC_HOST=takanorino-mac.tailnet.ts.net npm run dev:remote");
  }

  return host;
}

function loadBuildModule() {
  delete require.cache[require.resolve(BUILD_MODULE_PATH)];
  return require(BUILD_MODULE_PATH);
}

function runBuild() {
  const { buildSite } = loadBuildModule();
  return buildSite();
}

function isOptimizableImage(filePath) {
  const relative = path.relative(IMAGE_ASSET_DIR, filePath);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    OPTIMIZABLE_IMAGE_SUFFIXES.has(path.extname(filePath).toLowerCase())
  );
}

function optimizeImage(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const result = spawnSync(
    process.env.PYTHON || "python3",
    [IMAGE_OPTIMIZER_PATH, filePath, "--webp-lossless"],
    { cwd: ROOT, encoding: "utf8" }
  );

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || "Unknown optimizer error").trim();
    throw new Error(`Image optimization failed for ${path.relative(ROOT, filePath)}: ${detail}`);
  }

  const summary = String(result.stdout || "")
    .split("\n")
    .filter((line) => /^(optimized|created|Result:|Optimized:|WebP sidecars:)/.test(line))
    .join(" | ");
  console.log(`[images] ${path.relative(ROOT, filePath)}${summary ? ` | ${summary}` : ""}`);

  return /^created .*\.webp:/m.test(String(result.stdout || ""))
    ? filePath.slice(0, -path.extname(filePath).length) + ".webp"
    : null;
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function toSafeRelativePath(requestPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(requestPath);
  } catch (error) {
    return null;
  }

  const rawSegments = pathname.split("/").filter(Boolean);
  if (rawSegments.some((segment) => segment === "..")) {
    return null;
  }

  return rawSegments.join(path.sep);
}

function isInsideRoot(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveFilePath(urlPath) {
  if (urlPath === "/") {
    return path.join(ROOT, "index.html");
  }

  const relativePath = toSafeRelativePath(urlPath);
  if (relativePath == null) {
    return null;
  }

  const candidates = [];
  if (path.extname(relativePath)) {
    candidates.push(path.join(ROOT, relativePath));
  } else {
    candidates.push(path.join(ROOT, relativePath));
    candidates.push(path.join(ROOT, relativePath, "index.html"));
  }

  for (const candidate of candidates) {
    if (!isInsideRoot(candidate)) {
      continue;
    }

    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return candidate;
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

function sendResponse(res, statusCode, headers, body, method) {
  res.writeHead(statusCode, headers);
  if (method !== "HEAD") {
    res.end(body);
    return;
  }

  res.end();
}

function createRequestHandler() {
  return function handleRequest(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendResponse(
        res,
        405,
        {
          "Allow": "GET, HEAD",
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        },
        "Method Not Allowed",
        req.method
      );
      return;
    }

    let url;
    try {
      url = new URL(req.url || "/", "http://127.0.0.1");
    } catch (error) {
      sendResponse(
        res,
        400,
        {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        },
        "Bad Request",
        req.method
      );
      return;
    }

    const filePath = resolveFilePath(url.pathname);
    if (!filePath) {
      sendResponse(
        res,
        404,
        {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        },
        "Not Found",
        req.method
      );
      return;
    }

    try {
      const body = fs.readFileSync(filePath);
      sendResponse(
        res,
        200,
        {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
          "Content-Length": body.length,
          "Content-Type": getContentType(filePath),
          "X-Content-Type-Options": "nosniff"
        },
        body,
        req.method
      );
    } catch (error) {
      sendResponse(
        res,
        500,
        {
          "Cache-Control": "no-store",
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff"
        },
        "Internal Server Error",
        req.method
      );
    }
  };
}

function createWatchers(onChange) {
  return WATCH_TARGETS.map((targetPath) => {
    const stat = fs.statSync(targetPath);
    const labelBase = stat.isDirectory() ? path.basename(targetPath) : "";
    return fs.watch(
      targetPath,
      { recursive: stat.isDirectory() },
      function handleWatchEvent(_eventType, filename) {
        const targetLabel = filename ? path.join(labelBase, String(filename)) : path.basename(targetPath);
        const changedPath = filename ? path.join(targetPath, String(filename)) : targetPath;
        onChange({
          path: changedPath,
          fingerprint: getFingerprint(changedPath),
          label: targetLabel
        });
      }
    );
  });
}

function getFingerprint(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return `${stat.isDirectory() ? "dir" : "file"}:${stat.size}:${stat.mtimeMs}`;
  } catch (error) {
    return "missing";
  }
}

function main() {
  const port = parsePort(process.env.PORT);
  const publicHost = getPublicHost();
  const localUrl = `http://127.0.0.1:${port}`;
  const remoteUrl = `http://${publicHost}:${port}`;

  try {
    runBuild();
  } catch (error) {
    console.error("Initial build failed:", error.message);
    process.exit(1);
  }

  const server = http.createServer(createRequestHandler());
  const lastBuiltFingerprints = new Map();
  const pendingFingerprints = new Map();
  const pendingReasons = new Set();
  const pendingImagePaths = new Set();
  const generatedImageEvents = new Map();
  let rebuildTimer = null;
  let lastBuildAt = Date.now();
  let watchers = [];

  function scheduleBuild(reason) {
    if (reason.path && path.basename(reason.path).includes(".optimize-tmp")) {
      return;
    }

    const generatedEventExpiresAt = reason.path ? generatedImageEvents.get(reason.path) : null;
    if (generatedEventExpiresAt && generatedEventExpiresAt > Date.now()) {
      return;
    }
    if (reason.path && generatedEventExpiresAt) {
      generatedImageEvents.delete(reason.path);
    }

    if (lastBuiltFingerprints.get(reason.label) === reason.fingerprint) {
      return;
    }

    pendingFingerprints.set(reason.label, reason.fingerprint);
    pendingReasons.add(reason.label);
    if (reason.path && isOptimizableImage(reason.path)) {
      pendingImagePaths.add(reason.path);
    }
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
    }

    const waitMs = Math.max(
      pendingImagePaths.size ? IMAGE_OPTIMIZE_DEBOUNCE_MS : REBUILD_DEBOUNCE_MS,
      MIN_REBUILD_INTERVAL_MS - (Date.now() - lastBuildAt)
    );

    rebuildTimer = setTimeout(function rebuildFromWatch() {
      rebuildTimer = null;
      const reasons = Array.from(pendingReasons);
      const imagePaths = Array.from(pendingImagePaths);
      pendingReasons.clear();
      pendingImagePaths.clear();
      console.log(`[watch] Rebuilding due to: ${reasons.join(", ")}`);
      try {
        imagePaths.forEach((imagePath) => {
          const generatedPath = optimizeImage(imagePath);
          if (generatedPath) {
            generatedImageEvents.set(generatedPath, Date.now() + GENERATED_IMAGE_EVENT_TTL_MS);
          }
        });
        runBuild();
        lastBuildAt = Date.now();
        reasons.forEach((label) => {
          lastBuiltFingerprints.set(label, pendingFingerprints.get(label));
          pendingFingerprints.delete(label);
        });
      } catch (error) {
        console.error("Rebuild failed:", error.message);
      }
    }, waitMs);
  }

  function shutdown(signal) {
    watchers.forEach((watcher) => watcher.close());
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = null;
    }

    server.close(function closeServer() {
      console.log(`Stopped dev server (${signal}).`);
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.on("error", function handleServerError(error) {
    watchers.forEach((watcher) => watcher.close());
    console.error(`Failed to start dev server: ${error.message}`);
    process.exit(1);
  });

  server.listen(port, "0.0.0.0", function handleListen() {
    watchers = createWatchers(scheduleBuild);
    console.log("Remote preview server is running.");
    console.log(`- Mac: ${localUrl}`);
    console.log(`- iPhone: ${remoteUrl}`);
  });
}

main();
