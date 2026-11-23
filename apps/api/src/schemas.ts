import { z } from "zod";
import { PRIORITIES, ROLES, STATUSES } from "./db.js";

const email = z.string().trim().toLowerCase().pipe(z.email());
const id = z.number().int().positive();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const createUserSchema = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(ROLES),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(PRIORITIES).default("medium"),
  assigneeId: id.nullable().optional(),
});

export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(5000),
    status: z.enum(STATUSES),
    priority: z.enum(PRIORITIES),
    assigneeId: id.nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

export const listTicketsQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParam = z.coerce.number().int().positive();
