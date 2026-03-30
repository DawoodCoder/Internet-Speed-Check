import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/ping", (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.send("pong");
  });

  app.get("/api/download", (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'application/octet-stream');
    const size = parseInt(req.query.size as string) || 20 * 1024 * 1024;
    const chunkSize = 1024 * 1024; // 1MB
    const chunk = Buffer.alloc(chunkSize, '0');
    let sent = 0;
    
    const sendChunk = () => {
      let canWrite = true;
      while (sent < size && canWrite) {
        const toSend = Math.min(chunkSize, size - sent);
        canWrite = res.write(chunk.subarray(0, toSend));
        sent += toSend;
      }
      if (sent < size) {
        res.once('drain', sendChunk);
      } else {
        res.end();
      }
    };
    sendChunk();
  });

  app.post("/api/upload", (req, res) => {
    req.on('data', () => {
      // Consume data
    });
    req.on('end', () => {
      res.send("ok");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
