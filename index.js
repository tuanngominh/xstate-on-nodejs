import express from 'express';
import * as shortid from 'shortid';
import {nextStep as asyncMachineNextStep} from "./async-machine.js";
import {nextStep as syncMachineNextStep} from "./sync-machine.js";

const app = express();
app.use(express.json());

app.post('/async-machine', async (req, res, next) => {
  try {
    const jobId = !!req.body && !!req.body.jobId ? req.body.jobId : shortid.generate();

    const machine = await asyncMachineNextStep(jobId);
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('await so machine has time to run async effect');
        resolve();
      }, 3000);
    })
    console.log('------')
    return res.status(200).json({
      jobId,
      step: machine.state.value,
      context: machine.state.context
    })
  } catch (e) {
    next(e);
  }
});

app.post('/sync-machine', async (req, res, next) => {
  try {
    const jobId = !!req.body && !!req.body.jobId ? req.body.jobId : shortid.generate();

    const machine = await syncMachineNextStep(jobId);
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

