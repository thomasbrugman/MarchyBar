import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Omarchy 4.5 gives every physical monitor its own block of ten workspaces
// (first monitor 1-10, next 11-20, ...) and records that in this state file.
export const BLOCK_SIZE = 10;

export function perMonitorStateFile(env = process.env) {
  const state = env.XDG_STATE_HOME || path.join(env.HOME || os.homedir(), '.local', 'state');
  return path.join(state, 'omarchy', 'monitor-workspaces');
}

export function readWorkspaceBlocks(file = perMonitorStateFile()) {
  let state;
  try { state = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const blocks = new Map();
  for (const line of state.split('\n')) {
    const [block, connector, identity] = line.split('\t');
    if (/^\d+$/.test(block) && connector && identity) blocks.set(connector, Number(block));
  }
  return blocks;
}

// Pick the workspaces to show on the Touch Bar. Omarchy 4.0 keeps one global
// list. With per-monitor workspaces only the focused monitor's workspaces are
// shown, labelled 1-10 like the Omarchy bar. The id stays global because it is
// the focus target.
export function visibleWorkspaces(workspaces, active, perMonitor, block) {
  const list = workspaces.filter(w => w.id > 0).sort((a, b) => a.id - b.id);
  const label = w => (/^\d+$/.test(w.name) ? w.id : w.name);
  if (!perMonitor || !active || active.id <= 0) return list.map(w => ({ id: w.id, name: label(w), windows: w.windows }));
  const offset = (block ?? Math.floor((active.id - 1) / BLOCK_SIZE)) * BLOCK_SIZE;
  const sameMonitor = w => active.monitorID !== undefined && w.monitorID !== undefined && w.monitorID === active.monitorID;
  const inBlock = w => w.id > offset && w.id <= offset + BLOCK_SIZE;
  const owned = list.filter(inBlock);
  const guests = list.filter(w => !inBlock(w) && sameMonitor(w));
  return [...owned, ...guests].map(w => ({
    id: w.id,
    name: inBlock(w) && /^\d+$/.test(w.name) ? w.id - offset : label(w),
    windows: w.windows,
  }));
}
