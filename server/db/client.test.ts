import { describe, it, expect } from 'vitest'
import { createDb } from './client'

describe('createDb', () => {
  it('creates a db client and applies migrations', async () => {
    const { db, client, applyMigrations } = createDb('file::memory:?cache=shared')
    await applyMigrations()
    // After migrations users table should exist; insert a row.
    await client.execute({
      sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)',
      args: ['u1', 'a@b.c', 'h', new Date().toISOString()],
    })
    const result = await client.execute('SELECT id FROM users')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('u1')
    void db // db (drizzle) is exported but not exercised here; later tests use it
  })
})
