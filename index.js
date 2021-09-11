import express from 'express';
import * as shortid from 'shortid';
import fsSync, {promises as fs} from "fs";
import {getMachine} from './machine.js';

async function readState(jobId) {
  const stateFile = `state-storage/${jobId}.json`;
  if (!fsSync.existsSync(stateFile)) {
    return null;
  }
  const data = await fs.readFile(stateFile, 'utf8');
  return JSON.parse(data);
}

async function writeState(jobId, state) {
  const stateFile = `state-storage/${jobId}.json`;
  await fs.writeFile(stateFile, JSON.stringify(state))
}

export async function nextStep(jobId) {
  const state = await readState(jobId);

  const machine = getMachine(state);

  let stateToPersist;
  machine.onTransition(state => {
    if (state.changed) {
      console.log('state.changed', state.value);
      stateToPersist = state;
    }
  });

  machine.send({type: 'NEXT'});

  if (stateToPersist) {
    await writeState(jobId, stateToPersist);
  }

  return machine;
}

const app = express();
app.use(express.json());
app.post('/', async (req, res, next) => {
  try {
    const jobId = !!req.body && !!req.body.jobId ? req.body.jobId : shortid.generate();

    const machine = await nextStep(jobId);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('await');
        resolve();
      }, 10000);
    })
    return res.status(200).json({
      jobId,
      step: machine.state.value,
      context: machine.state.context
    })
  } catch (e) {
    next(e);
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT);
console.log(`Running on ${PORT}`);

