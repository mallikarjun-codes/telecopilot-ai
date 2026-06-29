const { z } = require('zod');

const passwordSchema = z
  .string()
  .trim()
  .min(8, 'Password must be at least 8 characters long.')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character.');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long.').max(100, 'Name must not exceed 100 characters.'),
  email: z.string().trim().email('Please provide a valid email address.'),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email('Please provide a valid email address.'),
  password: z.string().trim().min(1, 'Password is required.'),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required.'),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
