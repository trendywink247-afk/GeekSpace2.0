/**
 * @module UserRepository
 *
 * Centralised data-access layer for the **`users`** table.
 *
 * This repository encapsulates every SQL query that touches user records --
 * lookups by id / email / username, plan & credit checks, profile updates,
 * and activity tracking.  Route handlers and services should prefer these
 * methods over inline `db.prepare()` calls to keep query logic in one place.
 *
 * **Owned table:** `users`
 *
 * @remarks
 * - All finder methods return `undefined` when no matching row exists.
 * - The generic {@link UserRepository.update | update()} helper dynamically
 *   builds a `SET` clause from the provided fields object, so callers must
 *   validate field names before passing them in.
 * - The `credits` column is a legacy balance for free-tier users; paid plans
 *   use {@link SubscriptionRepository} for credit tracking instead.
 */

import type Database from 'better-sqlite3';

/**
 * Raw row shape returned by `SELECT * FROM users`.
 *
 * All columns map 1-to-1 to the SQLite schema.  JSON-encoded fields
 * (e.g. `tags`) are stored as plain strings and must be parsed by the caller.
 */
export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  name: string;
  /** Initials, emoji, or URL used as an avatar in the UI. */
  avatar: string;
  bio: string;
  location: string;
  website: string;
  /** 'user' | 'admin' */
  role: string;
  company: string;
  /** JSON-encoded string array of skill/interest tags. */
  tags: string;
  theme_mode: string;
  theme_accent: string;
  /** Subscription plan identifier: 'free' | 'pro' | 'team'. */
  plan: string;
  /** Legacy free-user credit balance (superseded by subscriptions.credits_remaining for paid plans). */
  credits: number;
  /** SQLite boolean (0 | 1). */
  onboarding_completed: number;
  /** ISO 8601 timestamp of most recent activity. */
  last_active: string;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/**
 * Centralised data-access layer for the `users` table.
 * Prefer these methods over inline `db.prepare()` calls in route handlers.
 */
export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  /**
   * Find a user by primary key.
   * @param id - UUID of the user.
   * @returns The matching UserRow, or undefined if not found.
   */
  findById(id: string): UserRow | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
  }

  /**
   * Find a user by email address (case-sensitive).
   * @param email - The user's email address.
   * @returns The matching UserRow, or undefined if not found.
   */
  findByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;
  }

  /**
   * Find a user by their unique username.
   * @param username - The user's handle (no @ prefix).
   * @returns The matching UserRow, or undefined if not found.
   */
  findByUsername(username: string): UserRow | undefined {
    return this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;
  }

  /**
   * Lightweight lookup for billing and usage routes.
   * @param id - UUID of the user.
   * @returns Object with `plan` and legacy `credits` balance, or undefined if not found.
   */
  getPlanAndCredits(id: string): { plan: string; credits: number } | undefined {
    return this.db
      .prepare('SELECT plan, credits FROM users WHERE id = ?')
      .get(id) as { plan: string; credits: number } | undefined;
  }

  /**
   * Generic partial update -- only the keys present in `fields` are SET.
   *
   * Dynamically builds `UPDATE users SET col1 = ?, col2 = ? ... WHERE id = ?`.
   * Fields whose value is `undefined` are silently skipped; if every field is
   * `undefined` the method returns immediately without executing a query.
   *
   * @param id - UUID of the user to update.
   * @param fields - A partial map of column names to new values.
   *   The `id` and `created_at` columns are excluded from the type to prevent
   *   accidental mutation of immutable keys.
   *
   * @remarks
   * **Caller is responsible for validating field names** -- this method trusts
   * that the keys in `fields` correspond to real columns.  Passing arbitrary
   * user-supplied keys could result in SQL errors or injection.
   */
  update(id: string, fields: Partial<Omit<UserRow, 'id' | 'created_at'>>): void {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    this.db
      .prepare(`UPDATE users SET ${setClauses} WHERE id = ?`)
      .run(...values, id);
  }

  /**
   * Updates `last_active` to the current UTC time.
   * @param id - UUID of the user to touch.
   */
  touchLastActive(id: string): void {
    this.db
      .prepare("UPDATE users SET last_active = datetime('now') WHERE id = ?")
      .run(id);
  }
}
