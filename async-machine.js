import {createMachine, interpret, State, assign} from 'xstate';
import {longRunAsyncTask1, longRunAsyncTask2, pollLongRunAsyncTask2} from './tasks.js';
import {readState, writeState} from './state-persistence.js';

const dagsMachine = createMachine(
  {
    id: 'runDag',
    initial: 'blank',
    context: {},
    states: {
      blank: {
        on: {
          NEXT: 'task1'
        }
      },
      task1: {
        initial: 'task1Execute',
        states: {
          task1Execute: {
            invoke: {
              src: longRunAsyncTask1,
              onDone: {target: 'task1Done'},
              onError: {target: '#error'}
            },
          },
          task1Done: {
            type: 'final',
            on: {
              NEXT: '#task2'
            }
          }
        }
      },
      task2: {
        id: 'task2',
        initial: 'execute',
        states: {
          execute: {
            initial: 'task2Start',
            states: {
              task2Start: {
                invoke: {
                  src: longRunAsyncTask2,
                  onDone: {target: 'task2Done'},
                  onError: {target: '#error'}
                },
              },
              task2Done: {
                type: 'final'
              }
            },
            on: {
              NEXT: 'polling'
            }
          },
          polling: {
            invoke: {
              src: pollLongRunAsyncTask2,
              onDone: {target: 'checkPolling'},
              onError: {target: '#error'}
            }
          },
          checkPolling: {
            entry: ['setPollingResult'],
            always: [
              {target: '#finish', cond: 'tasks2Done'},
              {target: 'morePolling', cond: 'tasks2NotDone'}
            ]
          },
          morePolling: {
            NEXT: 'polling'
          }
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
    actions: {
      setPollingResult: assign({
        task2Count:  (context, event) => {
          console.log('actions > setPollingResult > task2Count', context, event)
          return event.data.task2Count;
        },
      })
    },
    guards: {
      tasks2Done: (context, event) => context.task2Count === 3 ,
      tasks2NotDone: (context, event) => context.task2Count < 3
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

  let stateToPersist;
  machine.onTransition(state => {
    if (state.changed) {
      stateToPersist = state;
      console.log('to state', machine.state.value);
    }
  });

  machine.send({type: 'NEXT'});


  if (stateToPersist) {
    await writeState(jobId, stateToPersist);
  }

  return machine;
}
