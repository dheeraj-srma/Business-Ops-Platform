import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { router as apiRouter } from './server/routes';
import { supabaseSyncService } from './server/supabaseSyncService';
import { isSupabaseConfigured } from './server/supabaseClient';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes mount FIRST
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Inventory Stock Management server running on http://0.0.0.0:${PORT}`);

    // Auto-sync inventory catalog from Supabase on startup
    if (isSupabaseConfigured()) {
      console.log('[Startup] Initiating automatic Supabase database synchronization...');
      supabaseSyncService.syncCatalogFromSupabase().catch((err) => {
        console.warn('[Startup] Background Supabase sync failed, continuing with cached state:', err);
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
