import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readContentFromDisk } from './helpers/content-node.js';
import { composePlan } from '../js/logic/compose.js';

test('Ruder-Warmup landet nie im normalen Pool', () => {
  const c = readContentFromDisk();
  for (let lvl = 1; lvl <= 8; lvl++) for (const minutes of [10, 15, 20]) for (let i = 0; i < 20; i++) {
    const plan = composePlan({ minutes, level: lvl, pain: 1, exercises: c.exercises, lastExerciseIds: [], lastUsed: {}, rng: Math.random, now: new Date() });
    assert.ok(!plan.items.some((it) => it.exerciseId === 'row-technique-warmup'));
  }
});
