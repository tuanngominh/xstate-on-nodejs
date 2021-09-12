import {createMachine, interpret, State, assign} from 'xstate';
import {readState, writeState} from './state-persistence.js';
import {longRunAsyncTask1, longRunAsyncTask2, pollLongRunAsyncTask2} from './tasks.js';
import jsonpath from 'jsonpath';
import lodash from 'lodash';
const {get, isNil} = lodash;


const dagsMachine = createMachine(
  {
    id: 'runDag',
    initial: 'task1',
    context: {},
    states: {
      task1: {
        meta: {
          run: 'longRunAsyncTask1'
        },
        exit: assign({
          task1Done: (context, event) => event.data.task1Done
        }),
        on: {
          NEXT: 'task2',
          ERROR: 'error'
        }
      },
      task2: {
        initial: 'execute',
        states: {
          execute: {
            meta: {
              run: 'longRunAsyncTask2'
            },
            on: {
              NEXT: 'polling',
              ERROR: '#error'
            }
          },
          polling: {
            meta: {
              run: 'pollLongRunAsyncTask2'
            },
            exit: assign({
              task2Count:  (context, event) => get(event, 'data.task2Count', 0),
            }),
            on: {
              NEXT: [
                {
                  target: '#finish',
                  cond: (context, event) => {
                    return (event.data.task2Count === 4);
                  },
                },
                {
                  target: 'checkPolling',
                  cond: (context, event) => {
                    return (event.data.task2Count < 4);
                  },
                },
              ],
              ERROR: '#error'
            }
          },
          checkPolling: {
            on: {
              NEXT: 'polling'
            }
          }
        }
      },
      finish: {
        id: 'finish',
        type: 'final'
      },
      error: {
        id: 'error',
        type: 'final'
      }
    }
  }
);

function getMachine(previousMachineState) {
  let resolvedState = null;
  if (previousMachineState) {
    const previousState = State.create(previousMachineState);
    resolvedState = dagsMachine.resolveState(previousState);
  }

  const service = interpret(dagsMachine);
  if (resolvedState) {
    service.start(resolvedState);
  } else {
    service.start();
  }
  return service;
}

export async function nextStep(jobId) {
  const state = await readState(jobId);
  const machine = getMachine(state);
  const functions = {
    'longRunAsyncTask1': longRunAsyncTask1,
    'longRunAsyncTask2': longRunAsyncTask2,
    'pollLongRunAsyncTask2': pollLongRunAsyncTask2
  }

  let stateToPersist;
  machine.onTransition(state => {
    if (state.changed) {
      stateToPersist = state;
    }
  });

  console.log('from state', machine.state.value);
  const functionName = jsonpath.value(machine.state.meta, '$..run');
  let result;
  if (functionName) {
    result = await functions[functionName](machine.state.context);
  }

  let syncTransition = false;
  do {
    machine.send({type: 'NEXT', data: result});
    console.log('to state', machine.state.value);
    console.log('to state meta', machine.state.meta)
    console.log('syncTransition', isNil(jsonpath.value(machine.state.meta, '$..run')))
    syncTransition = isNil(jsonpath.value(machine.state.meta, '$..run'));

  } while(syncTransition && !machine.state.done);

  console.log('------')

  if (stateToPersist) {
    await writeState(jobId, stateToPersist);
  }

  return machine;
}
