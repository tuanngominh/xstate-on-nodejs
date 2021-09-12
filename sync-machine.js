import {createMachine, interpret, State, assign} from 'xstate';
import {readState, writeState} from './state-persistence.js';
import {longRunAsyncTask1, longRunAsyncTask2, pollLongRunAsyncTask2} from './tasks.js';
import jsonpath from 'jsonpath';
import lodash from 'lodash';
const {get} = lodash;


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
            entry: assign({
              task2Count:  (context, event) => {
                console.log('actions > setPollingResult > task2Count', context, event)
                return get(event, 'data.task2Count', 0);
              },
            }),
            on: {
              NEXT: {
                target: '#finish',
                cond: (context, event) => {
                  console.log('context.task2Count === 3', context.task2Count === 3);
                  console.log('(event.data.task2Count === 3)', (event.data.task2Count === 3));
                  return (event.data.task2Count === 3);
                },
              },
              ERROR: '#error'
            }
          }
          // checkPolling: {
          //   entry: assign({
          //     task2Count:  (context, event) => {
          //       console.log('actions > setPollingResult > task2Count', context, event)
          //       return event.data.task2Count;
          //     },
          //   }),
          //   always: [
          //     {target: '#finish', cond: 'tasks2Done'},
          //     {target: 'polling', cond: 'tasks2NotDone'}
          //   ]
          // }
        },
        on: {
          NEXT: 'finish'
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
  },
  {
    guards: {
      tasks2Done: (context, event) => {
        console.log('tasks2Done', context.task2Count === 3, context);
        return context.task2Count === 3
      } ,
      tasks2NotDone: (context, event) => {
        console.log('tasks2NotDone', context.task2Count < 3, context);
        return context.task2Count < 3;
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

  console.log('from state', machine.state.value);
  const functionName = jsonpath.value(machine.state.meta, '$..run');

  const functions = {
    'longRunAsyncTask1': longRunAsyncTask1,
    'longRunAsyncTask2': longRunAsyncTask2,
    'pollLongRunAsyncTask2': pollLongRunAsyncTask2
  }
  let result;
  if (functionName) {
    result = await functions[functionName](machine.state.context);
  }

  let stateToPersist;
  machine.onTransition(state => {
    if (state.changed) {
      stateToPersist = state;
    }
  });

  machine.send({type: 'NEXT', data: result});

  console.log('to state', machine.state.value);
  console.log('------')

  if (stateToPersist) {
    await writeState(jobId, stateToPersist);
  }

  return machine;
}
