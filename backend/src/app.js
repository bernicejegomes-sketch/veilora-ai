import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import enrollmentRouter from './routes/enrollment.js';
import complaintContextRouter from './routes/complaintContext.js';
import submitRouter from './routes/submit.js';
import semaphoreGroupRouter from './routes/semaphoreGroup.js';

dotenv.config();

const app = express();

const permittedOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: permittedOrigin,
    credentials: true,
  })
);

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'incognito-backend',
  });
});

app.use('/api', enrollmentRouter);
app.use('/api', complaintContextRouter);
app.use('/api', submitRouter);
app.use('/api', semaphoreGroupRouter);

export default app;
