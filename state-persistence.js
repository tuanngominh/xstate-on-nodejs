import fsSync, {promises as fs} from 'fs';

export async function readState(jobId) {
  const stateFile = `state-storage/${jobId}.json`;
  if (!fsSync.existsSync(stateFile)) {
    return null;
  }
  const data = await fs.readFile(stateFile, 'utf8');
  return JSON.parse(data);
}

export async function writeState(jobId, state) {
  const stateFile = `state-storage/${jobId}.json`;
  await fs.writeFile(stateFile, JSON.stringify(state))
}
