import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { storage } from "./storage";
import { insertUserSchema, insertJobSchema, insertProviderSchema } from "@shared/schema";
import { z } from "zod";

export function registerRoutes(app: Express) {
  // --- PASSPORT & SESSION SETUP ---
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "menda_super_secret_key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        // NOTE: For a quick launch this is plain text, but you should add bcrypt hashing soon!
        if (!user || user.password !== password) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err as Error);
      }
    })
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user);
    } catch (err) {
      done(err as Error);
    }
  });

  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: "Unauthorized" });
  };

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      const user = await storage.insertUser(userData);
      req.login(user, (err) => {
        if (err) throw err;
        res.status(201).json(user);
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/me", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not logged in" });
    res.json(req.user);
  });

  // --- JOB ROUTES ---
  app.get("/api/jobs", requireAuth, async (req, res) => {
    const user = req.user as any;
    let jobs = [];
    if (user.role === "customer" || user.role === "property_manager") {
      jobs = await storage.getJobsByCustomerId(user.id);
    } else if (user.role === "provider") {
      const provider = await storage.getProviderByUserId(user.id);
      if (provider) jobs = await storage.getJobsByProviderId(provider.id);
    } else if (user.role === "admin") {
      jobs = await storage.getAllJobs();
    }
    res.json(jobs);
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const jobData = insertJobSchema.parse(req.body);
      const user = req.user as any;
      const job = await storage.insertJob({ ...jobData, customerId: user.id });
      res.status(201).json(job);
    } catch (error) {
      res.status(400).json({ error: "Invalid job data" });
    }
  });

  app.patch("/api/jobs/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const job = await storage.updateJobStatus(req.params.id, status);
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.patch("/api/jobs/:id/assign", requireAuth, async (req, res) => {
    try {
      const { providerId } = z.object({ providerId: z.string() }).parse(req.body);
      const job = await storage.assignProvider(req.params.id, providerId);
      res.json(job);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign provider" });
    }
  });

  // --- PROVIDER ROUTES ---
  app.get("/api/providers", requireAuth, async (req, res) => {
    const providers = await storage.getAllProviders();
    res.json(providers);
  });

  app.post("/api/providers/signup", requireAuth, async (req, res) => {
    try {
      const providerData = insertProviderSchema.parse(req.body);
      const user = req.user as any;
      const provider = await storage.insertProvider({ ...providerData, userId: user.id });
      res.status(201).json(provider);
    } catch (error) {
      res.status(400).json({ error: "Invalid provider data" });
    }
  });

  app.patch("/api/providers/:id/vet", requireAuth, async (req, res) => {
    try {
      const { status } = z.object({ status: z.union([z.literal("verified"), z.literal("rejected")]) }).parse(req.body);
      const provider = await storage.updateProviderStatus(req.params.id, status);
      res.json(provider);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vetting status" });
    }
  });

  app.get("/api/providers/earnings", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const provider = await storage.getProviderByUserId(user.id);
      if (!provider) return res.status(404).json({ error: "Provider profile not found" });
      res.json({ earnings: provider.earnings });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch earnings" });
    }
  });
}
