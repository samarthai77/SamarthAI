'use strict';
const { randomUUID } = require('node:crypto');
module.exports = function database(tables) {
  const state = { tables, writes: [], fail: null, uploads: [] };
  state.from = table => {
    let filters = [], operation = 'select', values, single = false, maximum, head = false, columns = '*';
    const q = {
      select(value = '*', options = {}) { columns = value; head = options.head; return q; },
      insert(value) { operation = 'insert'; values = value; return q; },
      upsert(value) { operation = 'upsert'; values = value; return q; },
      update(value) { operation = 'update'; values = value; return q; },
      delete() { operation = 'delete'; return q; },
      eq(key, value) { filters.push(row => row[key] === value); return q; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return q; },
      in(key, values) { filters.push(row => values.includes(row[key])); return q; },
      not() { return q; }, gte() { return q; }, lt() { return q; }, or() { return q; },
      order() { return q; }, limit(value) { maximum = value; return q; },
      single() { single = true; return q; }, maybeSingle() { single = true; return q; }, abortSignal() { return q; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (state.fail === table) return { data: null, error: { message: 'PRIVATE_DATABASE_DETAIL' } };
        tables[table] ||= [];
        let rows = tables[table].filter(row => filters.every(filter => filter(row)));
        if (operation === 'insert' || operation === 'upsert') {
          rows = structuredClone(Array.isArray(values) ? values : [values]).map(row => ({ id: randomUUID(), created_at: new Date().toISOString(), ...row }));
          for (const row of rows) {
            if (table === 'payment_webhook_events' && tables[table].some(item => item.event_id === row.event_id)) return { data: null, error: { code: '23505' } };
            if (operation === 'upsert') { const existing = tables[table].find(item => item.provider_invoice_id === row.provider_invoice_id); if (existing) { Object.assign(existing, row); continue; } }
            tables[table].push(row);
          }
        }
        if (operation === 'update') for (const row of rows) Object.assign(row, values);
        if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
        if (operation !== 'select') state.writes.push({ table, operation, values });
        const count = rows.length;
        if (maximum) rows = rows.slice(0, maximum);
        rows = rows.map(row => {
          if (columns === '*' || columns.includes('(')) return structuredClone(row);
          return Object.fromEntries(columns.split(',').map(key => key.trim()).filter(Boolean).map(key => [key, row[key]]));
        });
        return { data: head ? null : single ? rows[0] || null : rows, error: null, count };
      }).then(resolve, reject); }
    }; return q;
  };
  state.storage = { from() { return {
    async upload(name, bytes, options) { state.uploads.push({ name, bytes, options }); return { error: null }; },
    getPublicUrl(name) { return { data: { publicUrl: `https://fixture.supabase.co/${name}` } }; },
    async remove() { return { error: null }; }
  }; } };
  return state;
};
